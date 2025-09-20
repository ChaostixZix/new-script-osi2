const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
require('dotenv').config();

class BatchShareManager {
    constructor() {
        this.drive = null;
        this.sheets = null;
        this.cachedParticipants = [];
        this.scanResults = {};
        this.shareResults = [];
        this.batchUpdates = [];
        this.workerCount = parseInt(process.env.WORKER_COUNT) || Math.min(4, os.cpus().length);
        this.batchSize = parseInt(process.env.BATCH_SIZE) || 10;
        this.monitoringData = {
            startTime: null,
            endTime: null,
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            workers: [],
            progress: 0,
            status: 'idle'
        };
    }

    /**
     * Initialize Google APIs with service account credentials
     */
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

    /**
     * Load cached participants from JSON file
     */
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

    /**
     * Load scan results from JSON file
     */
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

    /**
     * Find folder ID for a participant by matching nama (case insensitive)
     */
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
                return folderId;
            }
        }

        return null;
    }

    /**
     * Create batches from participants list
     */
    createBatches(participants) {
        const batches = [];
        for (let i = 0; i < participants.length; i += this.batchSize) {
            batches.push(participants.slice(i, i + this.batchSize));
        }
        return batches;
    }

    /**
     * Process sharing using multiple workers
     */
    async processSharingWithWorkers() {
        console.log('🚀 Starting batch folder sharing process...');
        
        // Filter participants who are not yet shared and have matching folders
        const participantsToProcess = this.cachedParticipants.filter(p => {
            if (p.isShared) return false;
            const folderId = this.findFolderIdForParticipant(p.nama);
            return folderId !== null;
        });
        
        console.log(`📂 Found ${participantsToProcess.length} participants with folders that need sharing`);
        
        if (participantsToProcess.length === 0) {
            console.log('✅ No participants need folder sharing');
            return;
        }

        // Initialize monitoring
        this.monitoringData.startTime = new Date();
        this.monitoringData.totalTasks = participantsToProcess.length;
        this.monitoringData.status = 'processing';

        // Create batches
        const batches = this.createBatches(participantsToProcess);
        console.log(`📦 Created ${batches.length} batches with ${this.batchSize} participants each`);
        console.log(`👥 Using ${this.workerCount} workers`);

        // Create workers
        const workers = [];
        const workerPromises = [];

        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker(__filename, {
                workerData: {
                    workerId: i,
                    scanResults: this.scanResults,
                    batchSize: this.batchSize
                }
            });

            workers.push(worker);
            this.monitoringData.workers.push({
                id: i,
                status: 'idle',
                processedTasks: 0,
                failedTasks: 0
            });

            // Handle worker messages
            worker.on('message', (message) => {
                this.handleWorkerMessage(message, i);
            });

            worker.on('error', (error) => {
                console.error(`❌ Worker ${i} error:`, error);
                this.monitoringData.workers[i].status = 'error';
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`❌ Worker ${i} stopped with exit code ${code}`);
                }
            });
        }

        // Distribute batches to workers
        let batchIndex = 0;
        for (let i = 0; i < batches.length; i++) {
            const workerIndex = i % this.workerCount;
            const batch = batches[i];
            
            workers[workerIndex].postMessage({
                type: 'processBatch',
                batch: batch,
                batchIndex: i
            });
        }

        // Wait for all workers to complete
        await Promise.all(workers.map(worker => new Promise((resolve) => {
            worker.on('exit', resolve);
        })));

        this.monitoringData.endTime = new Date();
        this.monitoringData.status = 'completed';
        this.monitoringData.progress = 100;

        console.log('✅ All workers completed');
    }

    /**
     * Handle messages from workers
     */
    handleWorkerMessage(message, workerId) {
        switch (message.type) {
            case 'workerReady':
                this.monitoringData.workers[workerId].status = 'ready';
                break;
            case 'batchStarted':
                this.monitoringData.workers[workerId].status = 'processing';
                break;
            case 'taskCompleted':
                this.monitoringData.completedTasks++;
                this.monitoringData.workers[workerId].processedTasks++;
                this.shareResults.push(message.result);
                this.updateProgress();
                break;
            case 'taskFailed':
                this.monitoringData.failedTasks++;
                this.monitoringData.workers[workerId].failedTasks++;
                this.shareResults.push(message.result);
                this.updateProgress();
                break;
            case 'batchCompleted':
                this.monitoringData.workers[workerId].status = 'idle';
                break;
        }
    }

    /**
     * Update progress percentage
     */
    updateProgress() {
        const total = this.monitoringData.totalTasks;
        const completed = this.monitoringData.completedTasks + this.monitoringData.failedTasks;
        this.monitoringData.progress = Math.round((completed / total) * 100);
        
        if (completed % 10 === 0 || completed === total) {
            console.log(`📊 Progress: ${completed}/${total} (${this.monitoringData.progress}%)`);
        }
    }

    /**
     * Save monitoring data to JSON file
     */
    async saveMonitoringData() {
        try {
            const outputPath = path.join(__dirname, 'batch_monitoring.json');
            const monitoringData = {
                ...this.monitoringData,
                duration: this.monitoringData.endTime ? 
                    this.monitoringData.endTime - this.monitoringData.startTime : null,
                summary: {
                    totalTasks: this.monitoringData.totalTasks,
                    completedTasks: this.monitoringData.completedTasks,
                    failedTasks: this.monitoringData.failedTasks,
                    successRate: this.monitoringData.totalTasks > 0 ? 
                        Math.round((this.monitoringData.completedTasks / this.monitoringData.totalTasks) * 100) : 0
                }
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(monitoringData, null, 2));
            console.log(`📊 Monitoring data saved to: ${outputPath}`);
        } catch (error) {
            console.error('❌ Error saving monitoring data:', error.message);
        }
    }

    /**
     * Save sharing results to JSON file
     */
    async saveShareResults() {
        try {
            const outputPath = path.join(__dirname, 'share_peserta_folder_batch.json');
            const failedShares = this.shareResults.filter(r => !r.success);
            const successfulShares = this.shareResults.filter(r => r.success);
            
            const shareData = {
                timestamp: new Date().toISOString(),
                totalProcessed: this.shareResults.length,
                successfulShares: successfulShares.length,
                failedShares: failedShares.length,
                failedResults: failedShares,
                successfulSummary: successfulShares.map(r => ({
                    nama: r.participant.nama,
                    email: r.participant.email,
                    folderId: r.folderId,
                    timestamp: new Date().toISOString()
                })),
                monitoring: this.monitoringData
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(shareData, null, 2));
            console.log(`💾 Batch share results saved to: ${outputPath}`);
            console.log(`✅ Successfully shared: ${successfulShares.length} folders`);
            console.log(`❌ Failed shares: ${failedShares.length} folders`);
        } catch (error) {
            console.error('❌ Error saving share results:', error.message);
        }
    }

    /**
     * Prepare batch updates for Google Sheets
     */
    prepareBatchUpdates() {
        this.batchUpdates = [];
        
        for (const result of this.shareResults) {
            const participant = result.participant;
            
            if (result.success) {
                this.batchUpdates.push({
                    range: `Form Response 1!I${participant.row}`,
                    values: [['TRUE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${participant.row}`,
                    values: [[new Date().toISOString()]]
                });
            } else {
                this.batchUpdates.push({
                    range: `Form Response 1!I${participant.row}`,
                    values: [['FALSE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${participant.row}`,
                    values: [[`Failed: ${new Date().toISOString()}`]]
                });
            }
        }
    }

    /**
     * Get available worksheets in the spreadsheet
     */
    async getAvailableWorksheets() {
        try {
            const sheetId = process.env.GOOGLE_SHEET_ID;
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: sheetId
            });

            const worksheets = response.data.sheets.map(sheet => ({
                title: sheet.properties.title,
                sheetId: sheet.properties.sheetId
            }));

            return worksheets;
        } catch (error) {
            console.error('❌ Error getting worksheets:', error.message);
            throw error;
        }
    }

    /**
     * Batch update Google Sheets with sharing status
     */
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

    /**
     * Print detailed summary of batch processing
     */
    printSummary() {
        console.log('\n📋 BATCH PROCESSING SUMMARY');
        console.log('============================');
        
        const duration = this.monitoringData.endTime - this.monitoringData.startTime;
        const durationSeconds = Math.round(duration / 1000);
        
        console.log(`⏱️  Total Duration: ${durationSeconds} seconds`);
        console.log(`👥 Workers Used: ${this.workerCount}`);
        console.log(`📦 Batch Size: ${this.batchSize}`);
        console.log(`📊 Total Tasks: ${this.monitoringData.totalTasks}`);
        console.log(`✅ Completed: ${this.monitoringData.completedTasks}`);
        console.log(`❌ Failed: ${this.monitoringData.failedTasks}`);
        console.log(`📈 Success Rate: ${this.monitoringData.summary?.successRate || 0}%`);
        
        console.log('\n👥 Worker Performance:');
        this.monitoringData.workers.forEach((worker, index) => {
            console.log(`  Worker ${index}: ${worker.processedTasks} completed, ${worker.failedTasks} failed`);
        });
        
        console.log('\n📝 Next Steps:');
        console.log('- Check batch_monitoring.json for detailed performance metrics');
        console.log('- Check share_peserta_folder_batch.json for detailed results');
        console.log('- Failed shares can be retried by running the script again');
    }
}

// Worker thread code
if (!isMainThread) {
    const { google } = require('googleapis');
    const fs = require('fs');
    const path = require('path');
    
    let drive = null;
    let scanResults = workerData.scanResults;
    let workerId = workerData.workerId;
    
    // Initialize Google Drive API for worker
    async function initializeWorker() {
        try {
            const serviceAccountPath = path.join(__dirname, 'service.json');
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            
            const auth = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                serviceAccount.private_key,
                ['https://www.googleapis.com/auth/drive']
            );
            
            drive = google.drive({ version: 'v3', auth });
            parentPort.postMessage({ type: 'workerReady' });
        } catch (error) {
            console.error(`❌ Worker ${workerId} initialization failed:`, error.message);
            process.exit(1);
        }
    }
    
    // Find folder ID for a participant
    function findFolderIdForParticipant(participantNama) {
        const namaLower = participantNama.toLowerCase().trim();
        
        if (scanResults[namaLower]) {
            return scanResults[namaLower];
        }

        const namaClean = namaLower.replace(/\s+/g, ' ');
        if (scanResults[namaClean]) {
            return scanResults[namaClean];
        }

        for (const [folderName, folderId] of Object.entries(scanResults)) {
            const folderNameClean = folderName.toLowerCase().trim();
            if (folderNameClean.includes(namaClean) || namaClean.includes(folderNameClean)) {
                return folderId;
            }
        }

        return null;
    }
    
    // Share folder with participant email
    async function shareFolder(folderId, email, participantName) {
        try {
            const permission = {
                type: 'user',
                role: 'reader',
                emailAddress: email
            };

            const response = await drive.permissions.create({
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
            return {
                success: false,
                error: error.message,
                folderId,
                email,
                participantName
            };
        }
    }
    
    // Process a batch of participants
    async function processBatch(batch, batchIndex) {
        parentPort.postMessage({ type: 'batchStarted', batchIndex });
        
        for (const participant of batch) {
            const folderId = findFolderIdForParticipant(participant.nama);
            
            if (!folderId) {
                parentPort.postMessage({
                    type: 'taskFailed',
                    result: {
                        success: false,
                        error: 'Folder ID not found',
                        participant,
                        folderId: null
                    }
                });
                continue;
            }

            const shareResult = await shareFolder(folderId, participant.email, participant.nama);
            
            parentPort.postMessage({
                type: shareResult.success ? 'taskCompleted' : 'taskFailed',
                result: {
                    ...shareResult,
                    participant
                }
            });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        parentPort.postMessage({ type: 'batchCompleted', batchIndex });
    }
    
    // Handle messages from main thread
    parentPort.on('message', async (message) => {
        switch (message.type) {
            case 'processBatch':
                await processBatch(message.batch, message.batchIndex);
                break;
        }
    });
    
    // Initialize worker
    initializeWorker();
}

// Main execution function
async function main() {
    const batchManager = new BatchShareManager();
    
    try {
        // Initialize the batch manager
        const initialized = await batchManager.initialize();
        if (!initialized) {
            process.exit(1);
        }

        // Load cached participants
        batchManager.loadCachedParticipants();
        
        // Load scan results
        batchManager.loadScanResults();
        
        // Process sharing with workers
        await batchManager.processSharingWithWorkers();
        
        // Prepare batch updates
        batchManager.prepareBatchUpdates();
        
        // Save sharing results
        await batchManager.saveShareResults();
        
        // Save monitoring data
        await batchManager.saveMonitoringData();
        
        // Update Google Sheets
        await batchManager.updateSheets();
        
        // Print summary
        batchManager.printSummary();
        
        console.log('\n✅ Batch folder sharing completed successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = BatchShareManager;

// Run the script if called directly
if (require.main === module && isMainThread) {
    main();
}