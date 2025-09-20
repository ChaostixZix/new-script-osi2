const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class ParticipantCacheManager {
    constructor() {
        this.sheets = null;
        this.drive = null;
        this.cachedData = [];
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
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/spreadsheets.readonly'
                ]
            );

            // Initialize APIs
            this.sheets = google.sheets({ version: 'v4', auth });
            this.drive = google.drive({ version: 'v3', auth });
            
            console.log('✅ Google APIs initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Google APIs:', error.message);
            return false;
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

            console.log('📋 Available worksheets:');
            worksheets.forEach((worksheet, index) => {
                console.log(`${index + 1}. "${worksheet.title}" (ID: ${worksheet.sheetId})`);
            });

            return worksheets;
        } catch (error) {
            console.error('❌ Error getting worksheets:', error.message);
            throw error;
        }
    }

    /**
     * Cache participant data from Google Sheets
     */
    async cacheParticipants() {
        try {
            const sheetId = process.env.GOOGLE_SHEET_ID;
            let worksheetName = process.env.WORKSHEET_NAME || 'Form Response 1';

            if (!sheetId) {
                throw new Error('GOOGLE_SHEET_ID environment variable is required');
            }

            // First, get available worksheets
            const worksheets = await this.getAvailableWorksheets();
            
            // Check if the specified worksheet exists
            const targetWorksheet = worksheets.find(ws => 
                ws.title === worksheetName || 
                ws.title.toLowerCase() === worksheetName.toLowerCase()
            );

            if (!targetWorksheet) {
                console.log(`⚠️ Worksheet "${worksheetName}" not found. Using first available worksheet.`);
                worksheetName = worksheets[0].title;
                console.log(`📝 Using worksheet: "${worksheetName}"`);
            } else {
                worksheetName = targetWorksheet.title;
                console.log(`✅ Found worksheet: "${worksheetName}"`);
            }

            console.log(`🔍 Fetching data from sheet: ${sheetId}, worksheet: ${worksheetName}`);

            // Get all data from the worksheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${worksheetName}!A:J` // Assuming columns A-J cover all the headers
            });

            const rows = response.data.values;
            if (!rows || rows.length < 2) {
                throw new Error('No data found in the worksheet');
            }

            // Get headers (first row)
            const headers = rows[0];
            console.log('📋 Headers found:', headers);

            // Find column indices
            const timestampIndex = headers.indexOf('Timestamp');
            const emailIndex = headers.indexOf('Email Address');
            const namaIndex = headers.indexOf('Nama Peserta');
            const folderIdIndex = headers.indexOf('FolderId');
            const isSharedIndex = headers.indexOf('isShared');
            const lastLogIndex = headers.indexOf('LastLog');

            if (emailIndex === -1 || namaIndex === -1) {
                throw new Error('Required columns (Email Address, Nama Peserta) not found');
            }

            // Process data rows (skip header row)
            const participants = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 1; // 1-based row number

                // Skip rows where isShared is true
                const isShared = row[isSharedIndex] === 'TRUE' || row[isSharedIndex] === 'true';
                if (isShared) {
                    console.log(`⏭️ Skipping row ${rowNumber} - already shared`);
                    continue;
                }

                const participant = {
                    row: rowNumber,
                    email: row[emailIndex] || '',
                    nama: row[namaIndex] || '',
                    namaLower: (row[namaIndex] || '').toLowerCase(),
                    folderId: row[folderIdIndex] || '',
                    isShared: isShared,
                    lastLog: row[lastLogIndex] || '',
                    timestamp: row[timestampIndex] || ''
                };

                // Only include participants with valid email and nama
                if (participant.email && participant.nama) {
                    participants.push(participant);
                    console.log(`📝 Cached participant: ${participant.nama} (${participant.email}) - Row ${rowNumber}`);
                } else {
                    console.log(`⚠️ Skipping row ${rowNumber} - missing email or nama`);
                }
            }

            this.cachedData = participants;
            console.log(`✅ Cached ${participants.length} participants`);

            // Save to JSON file
            await this.saveCache();
            
            return participants;

        } catch (error) {
            console.error('❌ Error caching participants:', error.message);
            throw error;
        }
    }

    /**
     * Save cached data to JSON file
     */
    async saveCache() {
        try {
            const outputPath = path.join(__dirname, 'cache_peserta.json');
            const cacheData = {
                timestamp: new Date().toISOString(),
                totalParticipants: this.cachedData.length,
                participants: this.cachedData
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(cacheData, null, 2));
            console.log(`💾 Cache saved to: ${outputPath}`);
        } catch (error) {
            console.error('❌ Error saving cache:', error.message);
        }
    }

    /**
     * Load cached data from JSON file
     */
    loadCache() {
        try {
            const cachePath = path.join(__dirname, 'cache_peserta.json');
            if (fs.existsSync(cachePath)) {
                const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                this.cachedData = cacheData.participants || [];
                console.log(`📂 Loaded ${this.cachedData.length} participants from cache`);
                return this.cachedData;
            } else {
                console.log('📂 No cache file found');
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading cache:', error.message);
            return [];
        }
    }

    /**
     * Print summary of cached participants
     */
    printSummary() {
        console.log('\n📋 CACHE SUMMARY');
        console.log('================');
        console.log(`Total Participants: ${this.cachedData.length}`);
        
        this.cachedData.forEach((participant, index) => {
            console.log(`${index + 1}. ${participant.nama} (${participant.email}) - Row ${participant.row}`);
        });
    }
}

// Main execution function
async function main() {
    const cacheManager = new ParticipantCacheManager();
    
    try {
        // Initialize the cache manager
        const initialized = await cacheManager.initialize();
        if (!initialized) {
            process.exit(1);
        }

        // Cache participants from Google Sheets
        await cacheManager.cacheParticipants();
        
        // Print summary
        cacheManager.printSummary();
        
        console.log('\n✅ Participant caching completed successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = ParticipantCacheManager;

// Run the script if called directly
if (require.main === module) {
    main();
}