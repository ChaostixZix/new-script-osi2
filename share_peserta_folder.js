const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class FolderShareManager {
    constructor() {
        this.drive = null;
        this.sheets = null;
        this.cachedParticipants = [];
        this.scanResults = {};
        this.shareResults = [];
        this.batchUpdates = [];
    }

    /**
     * Initialize Google APIs with service account credentials
     */
    async initialize() {
        try {
            // Check if service.json exists
            const serviceAccountPath = path.join(__dirname, 'service.json');
            if (!fs.existsSync(serviceAccountPath)) {
                throw new Error('service.json file not found. Please place your Google service account credentials in the root directory.');
            }

            // Load service account credentials
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            
            // Create JWT client
            const auth = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                serviceAccount.private_key,
                [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/spreadsheets'
                ]
            );

            // Initialize APIs
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
            
            // Convert all folder names to lowercase for matching
            this.scanResults = {};
            for (const [folderName, folderId] of Object.entries(rawScanResults)) {
                const folderNameLower = folderName.toLowerCase().trim();
                this.scanResults[folderNameLower] = folderId;
            }
            
            console.log(`📂 Loaded scan results with ${Object.keys(this.scanResults).length} folders (converted to lowercase for matching)`);
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
        
        // Direct match
        if (this.scanResults[namaLower]) {
            return this.scanResults[namaLower];
        }

        // Try without extra spaces
        const namaClean = namaLower.replace(/\s+/g, ' ');
        if (this.scanResults[namaClean]) {
            return this.scanResults[namaClean];
        }

        // Partial match - find folder name that contains the participant name
        for (const [folderName, folderId] of Object.entries(this.scanResults)) {
            const folderNameClean = folderName.toLowerCase().trim();
            if (folderNameClean.includes(namaClean) || namaClean.includes(folderNameClean)) {
                console.log(`🔍 Partial match found: "${participantNama}" matches folder "${folderName}"`);
                return folderId;
            }
        }

        return null;
    }

    /**
     * Share folder with participant email
     */
    async shareFolder(folderId, email, participantName) {
        try {
            console.log(`🔗 Sharing folder ${folderId} with ${email} (${participantName})`);

            const permission = {
                type: 'user',
                role: 'reader',
                emailAddress: email
            };

            const response = await this.drive.permissions.create({
                fileId: folderId,
                resource: permission,
                sendNotificationEmail: false // Don't send email notification
            });

            console.log(`✅ Successfully shared folder with ${email}`);
            return {
                success: true,
                permissionId: response.data.id,
                folderId,
                email,
                participantName
            };

        } catch (error) {
            console.error(`❌ Error sharing folder ${folderId} with ${email}:`, error.message);
            return {
                success: false,
                error: error.message,
                folderId,
                email,
                participantName
            };
        }
    }

    /**
     * Process sharing for all participants
     */
    async processSharing() {
        console.log('🚀 Starting folder sharing process...');
        
        // Filter participants who are not yet shared and have matching folders
        const participantsToProcess = this.cachedParticipants.filter(p => {
            if (p.isShared) return false;
            const folderId = this.findFolderIdForParticipant(p.nama);
            return folderId !== null;
        });
        
        console.log(`📂 Found ${participantsToProcess.length} participants with folders that need sharing (out of ${this.cachedParticipants.length} total)`);
        
        if (participantsToProcess.length === 0) {
            console.log('✅ No participants need folder sharing - all folders are already shared or don\'t exist');
            return;
        }
        
        for (const participant of participantsToProcess) {
            // Find folder ID using scan results
            const folderId = this.findFolderIdForParticipant(participant.nama);
            
            if (!folderId) {
                console.log(`⚠️ No folder ID found for participant: ${participant.nama} - SKIPPING`);
                this.shareResults.push({
                    success: false,
                    error: 'Folder ID not found',
                    participant,
                    folderId: null
                });
                
                // Set isShared to false for failed shares
                this.batchUpdates.push({
                    range: `Form Response 1!I${participant.row}`, // isShared column
                    values: [['FALSE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${participant.row}`, // LastLog column
                    values: [[`Failed: ${new Date().toISOString()}`]]
                });
                continue;
            }

            // Share the folder
            const shareResult = await this.shareFolder(folderId, participant.email, participant.nama);
            
            this.shareResults.push({
                ...shareResult,
                participant
            });

            // Prepare batch update for Google Sheets
            if (shareResult.success) {
                this.batchUpdates.push({
                    range: `Form Response 1!I${participant.row}`, // isShared column
                    values: [['TRUE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${participant.row}`, // LastLog column
                    values: [[new Date().toISOString()]]
                });
            } else {
                // Set isShared to false for failed shares
                this.batchUpdates.push({
                    range: `Form Response 1!I${participant.row}`, // isShared column
                    values: [['FALSE']]
                });
                this.batchUpdates.push({
                    range: `Form Response 1!J${participant.row}`, // LastLog column
                    values: [[`Failed: ${new Date().toISOString()}`]]
                });
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ Completed sharing process for ${participantsToProcess.length} participants`);
    }

    /**
     * Save sharing results to JSON file (only failed shares)
     */
    async saveShareResults() {
        try {
            const outputPath = path.join(__dirname, 'share_peserta_folder.json');
            const failedShares = this.shareResults.filter(r => !r.success);
            const successfulShares = this.shareResults.filter(r => r.success);
            
            const shareData = {
                timestamp: new Date().toISOString(),
                totalProcessed: this.shareResults.length,
                successfulShares: successfulShares.length,
                failedShares: failedShares.length,
                // Only save failed shares to avoid reprocessing successful ones
                failedResults: failedShares,
                // Keep summary of successful shares for reference
                successfulSummary: successfulShares.map(r => ({
                    nama: r.participant.nama,
                    email: r.participant.email,
                    folderId: r.folderId,
                    timestamp: new Date().toISOString()
                }))
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(shareData, null, 2));
            console.log(`💾 Share results saved to: ${outputPath}`);
            console.log(`✅ Successfully shared: ${successfulShares.length} folders`);
            console.log(`❌ Failed shares: ${failedShares.length} folders (saved for retry)`);
        } catch (error) {
            console.error('❌ Error saving share results:', error.message);
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

            // Get worksheet name
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

            // Update the batch updates with the correct worksheet name
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
     * Print summary of sharing results
     */
    printSummary() {
        console.log('\n📋 SHARING SUMMARY');
        console.log('==================');
        
        const successful = this.shareResults.filter(r => r.success);
        const failed = this.shareResults.filter(r => !r.success);
        
        console.log(`Total Processed: ${this.shareResults.length}`);
        console.log(`✅ Successful Shares: ${successful.length} (will be marked as isShared=true)`);
        console.log(`❌ Failed Shares: ${failed.length} (will be marked as isShared=false)`);
        
        if (successful.length > 0) {
            console.log('\n✅ Successfully Shared:');
            successful.forEach((result, index) => {
                console.log(`${index + 1}. ${result.participant.nama} (${result.participant.email}) - Folder: ${result.folderId}`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ Failed Shares (will be retried next time):');
            failed.forEach((result, index) => {
                console.log(`${index + 1}. ${result.participant.nama} (${result.participant.email}) - Error: ${result.error}`);
            });
        }
        
        console.log('\n📝 Next Steps:');
        console.log('- Successful shares: Removed from JSON, marked as isShared=true in sheets');
        console.log('- Failed shares: Kept in JSON for retry, marked as isShared=false in sheets');
        console.log('- Run the script again to retry failed shares only');
    }
}

// Main execution function
async function main() {
    const shareManager = new FolderShareManager();
    
    try {
        // Initialize the share manager
        const initialized = await shareManager.initialize();
        if (!initialized) {
            process.exit(1);
        }

        // Load cached participants
        shareManager.loadCachedParticipants();
        
        // Load scan results
        shareManager.loadScanResults();
        
        // Process sharing
        await shareManager.processSharing();
        
        // Save sharing results
        await shareManager.saveShareResults();
        
        // Update Google Sheets
        await shareManager.updateSheets();
        
        // Print summary
        shareManager.printSummary();
        
        console.log('\n✅ Folder sharing completed successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = FolderShareManager;

// Run the script if called directly
if (require.main === module) {
    main();
}