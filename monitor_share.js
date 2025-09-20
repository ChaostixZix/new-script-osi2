const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');
const { Worker } = require('worker_threads');
require('dotenv').config();

class BatchShareMonitor {
    constructor() {
        this.drive = null;
        this.sheets = null;
        this.cachedParticipants = [];
        this.scanResults = {};
        this.shareResults = [];
        this.batchUpdates = [];

        // Multi-worker configuration
        this.workerCount = 16;
        this.workers = [];
        this.taskQueue = [];
        this.activeWorkers = 0;
        this.completedTasks = 0;

        // Worker status tracking
        this.workerStats = Array(this.workerCount).fill(null).map((_, index) => ({
            id: index,
            status: 'idle', // idle, working, error
            currentParticipant: null,
            tasksCompleted: 0,
            errors: 0
        }));

        // Progress tracking
        this.progressStats = {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            errors: 0,
            activeWorkers: 0
        };

        // Error tracking
        this.errorLog = [];
        this.startTime = new Date();
    }

    async initialize() {
        try {
            const serviceAccountPath = path.join(__dirname, 'service.json');
            if (!fs.existsSync(serviceAccountPath)) {
                throw new Error('service.json file not found. Please place your Google service account credentials in the root directory.');
            }

            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

            const auth = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                serviceAccount.private_key,
                [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/spreadsheets'
                ]
            );

            this.drive = google.drive({ version: 'v3', auth });
            this.sheets = google.sheets({ version: 'v4', auth });

            console.log('✅ Google APIs initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Google APIs:', error.message);
            return false;
        }
    }

    loadCachedParticipants() {
        try {
            const cachePath = path.join(__dirname, 'cache_peserta.json');
            if (!fs.existsSync(cachePath)) {
                throw new Error('cache_peserta.json not found. Please run cache_peserta.js first.');
            }

            const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            this.cachedParticipants = cacheData.participants || [];
            console.log(`📂 Loaded ${this.cachedParticipants.length} participants from cache`);
            return this.cachedParticipants;
        } catch (error) {
            console.error('❌ Error loading cached participants:', error.message);
            throw error;
        }
    }

    loadScanResults() {
        try {
            const scanPath = path.join(__dirname, 'scan_results.json');
            if (!fs.existsSync(scanPath)) {
                throw new Error('scan_results.json not found. Please run cache.js first.');
            }

            const rawScanResults = JSON.parse(fs.readFileSync(scanPath, 'utf8'));

            this.scanResults = {};
            for (const [folderName, folderId] of Object.entries(rawScanResults)) {
                const folderNameLower = folderName.toLowerCase().trim();
                this.scanResults[folderNameLower] = folderId;
            }

            console.log(`📂 Loaded scan results with ${Object.keys(this.scanResults).length} folders`);
            return this.scanResults;
        } catch (error) {
            console.error('❌ Error loading scan results:', error.message);
            throw error;
        }
    }

    findFolderIdForParticipant(participantNama) {
        const namaLower = participantNama.toLowerCase().trim();

        if (this.scanResults[namaLower]) {
            return this.scanResults[namaLower];
        }

        const namaClean = namaLower.replace(/\s+/g, ' ');
        if (this.scanResults[namaClean]) {
            return this.scanResults[namaClean];
        }

        for (const [folderName, folderId] of Object.entries(this.scanResults)) {
            const folderNameClean = folderName.toLowerCase().trim();
            if (folderNameClean.includes(namaClean) || namaClean.includes(folderNameClean)) {
                console.log(`🔍 Partial match found: "${participantNama}" matches folder "${folderName}"`);
                return folderId;
            }
        }

        return null;
    }

    async shareFolder(folderId, email, participantName) {
        try {
            const permission = {
                type: 'user',
                role: 'reader',
                emailAddress: email
            };

            const response = await this.drive.permissions.create({
                fileId: folderId,
                resource: permission,
                sendNotificationEmail: false
            });

            return {
                success: true,
                permissionId: response.data.id,
                folderId,
                email,
                participantName
            };

        } catch (error) {
            const errorInfo = {
                timestamp: new Date().toISOString(),
                participant: participantName,
                email,
                folderId,
                error: error.message,
                errorCode: error.code || 'UNKNOWN'
            };

            this.errorLog.push(errorInfo);

            return {
                success: false,
                error: error.message,
                folderId,
                email,
                participantName
            };
        }
    }

    displayMonitoringTable() {
        const now = new Date();
        const elapsed = Math.floor((now - this.startTime) / 1000);
        const estimatedTotal = this.progressStats.processed > 0 ?
            Math.floor((elapsed / this.progressStats.processed) * this.progressStats.total) : 0;
        const eta = estimatedTotal - elapsed;

        const table = new Table({
            head: ['Metric', 'Value', 'Percentage'],
            colWidths: [20, 12, 15]
        });

        const percentage = (count) => this.progressStats.total > 0 ?
            ((count / this.progressStats.total) * 100).toFixed(1) + '%' : '0%';

        const queueLength = this.taskQueue.length;
        const throughput = elapsed > 0 ? (this.progressStats.processed / elapsed).toFixed(2) : '0';

        table.push(
            ['📊 Total Participants', this.progressStats.total, '100%'],
            ['👥 Active Workers', `${this.progressStats.activeWorkers}/${this.workerCount}`, '---'],
            ['📋 Queue Length', queueLength, '---'],
            ['🔄 Processed', this.progressStats.processed, percentage(this.progressStats.processed)],
            ['✅ Successful', this.progressStats.successful, percentage(this.progressStats.successful)],
            ['❌ Failed', this.progressStats.failed, percentage(this.progressStats.failed)],
            ['⚠️ Errors', this.progressStats.errors, percentage(this.progressStats.errors)],
            ['⚡ Throughput', `${throughput}/s`, '---'],
            ['⏱️ Elapsed Time', `${elapsed}s`, '---'],
            ['⏳ ETA', eta > 0 ? `${eta}s` : '---', '---']
        );

        console.clear();
        console.log('🚀 MULTI-WORKER FOLDER SHARING MONITOR');
        console.log('======================================');
        console.log(table.toString());

        // Worker status table
        const workerTable = new Table({
            head: ['Worker', 'Status', 'Current Task', 'Completed', 'Errors'],
            colWidths: [8, 10, 25, 10, 8]
        });

        this.workerStats.forEach(worker => {
            const statusIcon = worker.status === 'working' ? '🔄' :
                             worker.status === 'error' ? '❌' : '💤';
            const currentTask = worker.currentParticipant ?
                worker.currentParticipant.substring(0, 20) + '...' : '---';

            workerTable.push([
                `W${worker.id}`,
                `${statusIcon} ${worker.status}`,
                currentTask,
                worker.tasksCompleted,
                worker.errors
            ]);
        });

        console.log('\n👥 Worker Status:');
        console.log(workerTable.toString());

        if (this.errorLog.length > 0) {
            console.log('\n🔴 Recent Errors:');
            const recentErrors = this.errorLog.slice(-3);
            recentErrors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.participant} - ${error.error}`);
            });
        }
    }

    async initializeWorkers() {
        console.log(`🚀 Initializing ${this.workerCount} workers...`);

        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker(path.join(__dirname, 'share-worker.js'), {
                workerData: { workerId: i }
            });

            worker.on('message', (message) => {
                this.handleWorkerMessage(message);
            });

            worker.on('error', (error) => {
                console.error(`❌ Worker ${i} error:`, error);
                this.workerStats[i].status = 'error';
                this.workerStats[i].errors++;
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`❌ Worker ${i} exited with code ${code}`);
                }
            });

            this.workers[i] = worker;
            worker.postMessage({ type: 'init' });
        }

        // Wait for all workers to initialize
        return new Promise((resolve) => {
            const checkInitialization = () => {
                const initializedWorkers = this.workerStats.filter(w => w.status === 'idle').length;
                if (initializedWorkers === this.workerCount) {
                    console.log(`✅ All ${this.workerCount} workers initialized`);
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        });
    }

    handleWorkerMessage(message) {
        const { type, workerId, result, error } = message;
        const worker = this.workerStats[workerId];

        switch (type) {
            case 'initialized':
                worker.status = 'idle';
                console.log(`🔧 Worker ${workerId} initialized and ready`);
                break;

            case 'success':
                worker.status = 'idle';
                worker.tasksCompleted++;
                worker.currentParticipant = null;

                this.shareResults.push(result);
                this.progressStats.processed++;
                this.progressStats.successful++;
                this.progressStats.activeWorkers--;

                // Add to batch updates
                this.batchUpdates.push({
                    range: `Form Response 1!I${result.participant.row}`,
                    values: [['TRUE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${result.participant.row}`,
                    values: [[new Date().toISOString()]]
                });

                this.assignNextTask(workerId);
                break;

            case 'error':
                worker.status = 'idle';
                worker.errors++;
                worker.currentParticipant = null;

                const errorInfo = {
                    timestamp: new Date().toISOString(),
                    participant: result.participant.nama,
                    email: result.email,
                    folderId: result.folderId,
                    error: result.error,
                    errorCode: result.errorCode,
                    workerId
                };

                this.errorLog.push(errorInfo);
                this.shareResults.push(result);
                this.progressStats.processed++;
                this.progressStats.failed++;
                this.progressStats.activeWorkers--;

                // Add to batch updates
                this.batchUpdates.push({
                    range: `Form Response 1!I${result.participant.row}`,
                    values: [['FALSE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${result.participant.row}`,
                    values: [[`Failed: ${new Date().toISOString()}`]]
                });

                this.assignNextTask(workerId);
                break;
        }

        this.displayMonitoringTable();
    }

    assignNextTask(workerId) {
        if (this.taskQueue.length === 0) {
            return;
        }

        const task = this.taskQueue.shift();
        const worker = this.workerStats[workerId];

        worker.status = 'working';
        worker.currentParticipant = task.participant.nama;
        this.progressStats.activeWorkers++;

        this.workers[workerId].postMessage({
            type: 'share',
            task
        });
    }

    async processWithWorkers() {
        const participantsToProcess = this.cachedParticipants.filter(p => {
            if (p.isShared) return false;
            const folderId = this.findFolderIdForParticipant(p.nama);
            return folderId !== null;
        });

        this.progressStats.total = participantsToProcess.length;

        console.log(`📂 Found ${participantsToProcess.length} participants to process with ${this.workerCount} workers`);

        if (participantsToProcess.length === 0) {
            console.log('✅ No participants need folder sharing');
            return;
        }

        // Build task queue
        for (const participant of participantsToProcess) {
            const folderId = this.findFolderIdForParticipant(participant.nama);

            if (!folderId) {
                // Handle participants without folders immediately
                const errorResult = {
                    success: false,
                    error: 'Folder ID not found',
                    participant,
                    folderId: null
                };

                this.shareResults.push(errorResult);
                this.progressStats.processed++;
                this.progressStats.errors++;

                this.batchUpdates.push({
                    range: `Form Response 1!I${participant.row}`,
                    values: [['FALSE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${participant.row}`,
                    values: [[`Failed: ${new Date().toISOString()}`]]
                });
                continue;
            }

            this.taskQueue.push({
                folderId,
                email: participant.email,
                participant
            });
        }

        console.log(`📋 Created task queue with ${this.taskQueue.length} sharing tasks`);

        // Start workers
        await this.initializeWorkers();

        // Assign initial tasks
        for (let i = 0; i < Math.min(this.workerCount, this.taskQueue.length); i++) {
            this.assignNextTask(i);
        }

        // Wait for all tasks to complete
        return new Promise((resolve) => {
            const checkCompletion = () => {
                if (this.taskQueue.length === 0 && this.progressStats.activeWorkers === 0) {
                    this.terminateWorkers();
                    resolve();
                } else {
                    setTimeout(checkCompletion, 500);
                }
            };
            checkCompletion();
        });
    }

    terminateWorkers() {
        console.log('🛑 Terminating all workers...');
        this.workers.forEach(worker => {
            worker.postMessage({ type: 'terminate' });
            worker.terminate();
        });
    }

    async processBatchSharing() {
        console.log('🚀 Starting multi-worker folder sharing process...');
        await this.processWithWorkers();
        this.displayMonitoringTable();
        console.log(`\n✅ Completed multi-worker processing`);
    }

    async saveDetailedResults() {
        try {
            const outputPath = path.join(__dirname, 'monitor_share_results.json');
            const failedShares = this.shareResults.filter(r => !r.success);
            const successfulShares = this.shareResults.filter(r => r.success);

            const detailedResults = {
                timestamp: new Date().toISOString(),
                workerConfig: {
                    workerCount: this.workerCount,
                    maxConcurrency: this.workerCount
                },
                statistics: {
                    totalProcessed: this.shareResults.length,
                    successfulShares: successfulShares.length,
                    failedShares: failedShares.length,
                    errorCount: this.errorLog.length,
                    processingTime: Math.floor((new Date() - this.startTime) / 1000)
                },
                errorLog: this.errorLog,
                failedResults: failedShares,
                successfulSummary: successfulShares.map(r => ({
                    nama: r.participant.nama,
                    email: r.participant.email,
                    folderId: r.folderId,
                    timestamp: new Date().toISOString()
                }))
            };

            fs.writeFileSync(outputPath, JSON.stringify(detailedResults, null, 2));
            console.log(`💾 Detailed results saved to: ${outputPath}`);

            // Error summary
            if (this.errorLog.length > 0) {
                console.log(`\n🔴 Error Summary (${this.errorLog.length} total errors):`);
                const errorTypes = {};
                this.errorLog.forEach(error => {
                    errorTypes[error.errorCode] = (errorTypes[error.errorCode] || 0) + 1;
                });

                Object.entries(errorTypes).forEach(([code, count]) => {
                    console.log(`- ${code}: ${count} errors`);
                });
            }

        } catch (error) {
            console.error('❌ Error saving detailed results:', error.message);
        }
    }

    async getAvailableWorksheets() {
        try {
            const sheetId = process.env.GOOGLE_SHEET_ID;
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: sheetId
            });

            return response.data.sheets.map(sheet => ({
                title: sheet.properties.title,
                sheetId: sheet.properties.sheetId
            }));
        } catch (error) {
            console.error('❌ Error getting worksheets:', error.message);
            throw error;
        }
    }

    async updateSheets() {
        try {
            if (this.batchUpdates.length === 0) {
                console.log('📝 No updates to apply to sheets');
                return;
            }

            const sheetId = process.env.GOOGLE_SHEET_ID;
            if (!sheetId) {
                throw new Error('GOOGLE_SHEET_ID environment variable is required');
            }

            const worksheets = await this.getAvailableWorksheets();
            let worksheetName = process.env.WORKSHEET_NAME || 'Form Response 1';

            const targetWorksheet = worksheets.find(ws =>
                ws.title === worksheetName ||
                ws.title.toLowerCase() === worksheetName.toLowerCase()
            );

            if (!targetWorksheet) {
                worksheetName = worksheets[0].title;
                console.log(`📝 Using worksheet: "${worksheetName}"`);
            }

            const updatedBatchUpdates = this.batchUpdates.map(update => ({
                ...update,
                range: update.range.replace('Form Response 1!', `${worksheetName}!`)
            }));

            console.log(`📝 Updating Google Sheets with ${updatedBatchUpdates.length} updates...`);

            const response = await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: sheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: updatedBatchUpdates
                }
            });

            console.log(`✅ Successfully updated ${updatedBatchUpdates.length} cells in Google Sheets`);
            return response.data;

        } catch (error) {
            console.error('❌ Error updating Google Sheets:', error.message);
            throw error;
        }
    }

    printDetailedSummary() {
        const totalTime = Math.floor((new Date() - this.startTime) / 1000);

        console.log('\n📋 BATCH SHARING DETAILED SUMMARY');
        console.log('=================================');

        const successful = this.shareResults.filter(r => r.success);
        const failed = this.shareResults.filter(r => !r.success);

        console.log(`⏱️ Total Processing Time: ${totalTime} seconds`);
        console.log(`👥 Worker Configuration: ${this.workerCount} workers, concurrent processing`);
        console.log(`📊 Total Processed: ${this.shareResults.length}`);
        console.log(`✅ Successful Shares: ${successful.length}`);
        console.log(`❌ Failed Shares: ${failed.length}`);
        console.log(`🔴 Total Errors: ${this.errorLog.length}`);

        if (successful.length > 0) {
            console.log('\n✅ Successfully Shared:');
            successful.forEach((result, index) => {
                console.log(`${index + 1}. ${result.participant.nama} (${result.participant.email})`);
            });
        }

        if (failed.length > 0) {
            console.log('\n❌ Failed Shares:');
            failed.forEach((result, index) => {
                console.log(`${index + 1}. ${result.participant.nama} - ${result.error}`);
            });
        }

        console.log('\n📝 Files Created:');
        console.log('- monitor_share_results.json: Detailed results and error log');
        console.log('- Google Sheets updated with sharing status');
    }
}

async function main() {
    const monitor = new BatchShareMonitor();

    try {
        const initialized = await monitor.initialize();
        if (!initialized) {
            process.exit(1);
        }

        monitor.loadCachedParticipants();
        monitor.loadScanResults();

        await monitor.processBatchSharing();
        await monitor.saveDetailedResults();
        await monitor.updateSheets();

        monitor.printDetailedSummary();

        console.log('\n✅ Batch folder sharing completed successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

module.exports = BatchShareMonitor;

if (require.main === module) {
    main();
}