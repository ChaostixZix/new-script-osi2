const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GoogleDriveCacheScanner {
    constructor() {
        this.drive = null;
        this.cache = new Map();
        this.scannedFolders = new Set();
    }

    /**
     * Initialize Google Drive API with service account credentials
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
                ['https://www.googleapis.com/auth/drive.readonly']
            );

            // Initialize Drive API
            this.drive = google.drive({ version: 'v3', auth });
            
            console.log('✅ Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Google Drive API:', error.message);
            return false;
        }
    }

    /**
     * Get folder contents by folder ID
     * @param {string} folderId - Google Drive folder ID
     * @param {number} depth - Current depth level
     * @param {number} maxDepth - Maximum depth to scan
     * @returns {Promise<Object>} Folder contents
     */
    async getFolderContents(folderId, depth = 0, maxDepth = 2) {
        try {
            // Check cache first
            const cacheKey = `${folderId}_${depth}`;
            if (this.cache.has(cacheKey)) {
                console.log(`📋 Using cached data for folder ${folderId} at depth ${depth}`);
                return this.cache.get(cacheKey);
            }

            console.log(`🔍 Scanning folder ${folderId} at depth ${depth}`);

            // Query for files and folders in the current folder
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, mimeType, size, modifiedTime, parents)',
                pageSize: 1000
            });

            const items = response.data.files || [];
            const folderContents = {};

            for (const item of items) {
                // If it's a folder and we haven't reached max depth, scan it recursively
                if (item.mimeType === 'application/vnd.google-apps.folder' && depth < maxDepth) {
                    console.log(`📁 Found subfolder: ${item.name} (ID: ${item.id})`);
                    
                    // Prevent infinite loops by checking if we've already scanned this folder
                    if (!this.scannedFolders.has(item.id)) {
                        this.scannedFolders.add(item.id);
                        const subfolderContents = await this.getFolderContents(item.id, depth + 1, maxDepth);
                        folderContents[item.name] = item.id;
                        // Merge subfolders to the same level
                        Object.assign(folderContents, subfolderContents);
                    }
                } else if (item.mimeType === 'application/vnd.google-apps.folder') {
                    // If we've reached max depth, just store the folder info without scanning
                    folderContents[item.name] = item.id;
                }
            }

            // Cache the results
            this.cache.set(cacheKey, folderContents);
            
            console.log(`✅ Scanned ${items.length} items in folder ${folderId} at depth ${depth}`);
            return folderContents;

        } catch (error) {
            console.error(`❌ Error scanning folder ${folderId} at depth ${depth}:`, error.message);
            return {};
        }
    }

    /**
     * Scan parent folder and its children (2 depth levels)
     * @param {string} parentFolderId - Parent folder ID to scan
     * @returns {Promise<Object>} Complete scan results
     */
    async scanParentFolder(parentFolderId) {
        try {
            console.log(`🚀 Starting scan of parent folder: ${parentFolderId}`);
            console.log(`📊 Maximum depth: 2 levels`);
            
            const startTime = Date.now();
            const results = await this.getFolderContents(parentFolderId, 0, 2);
            const endTime = Date.now();
            
            const scanSummary = results;

            console.log(`🎉 Scan completed in ${endTime - startTime}ms`);
            console.log(`📈 Total folders scanned: ${this.scannedFolders.size}`);
            console.log(`💾 Cache entries: ${this.cache.size}`);

            return scanSummary;

        } catch (error) {
            console.error('❌ Error during parent folder scan:', error.message);
            throw error;
        }
    }

    /**
     * Save scan results to a JSON file
     * @param {Object} results - Scan results to save
     * @param {string} filename - Output filename
     */
    async saveResults(results, filename = 'scan_results.json') {
        try {
            const outputPath = path.join(__dirname, filename);
            fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
            console.log(`💾 Results saved to: ${outputPath}`);
        } catch (error) {
            console.error('❌ Error saving results:', error.message);
        }
    }

    /**
     * Print a summary of the scan results
     * @param {Object} results - Scan results
     */
    printSummary(results) {
        console.log('\n📋 SCAN SUMMARY');
        console.log('================');
        console.log(`Folders Found: ${Object.keys(results).length}`);
        
        this.printFolderSummary(results, 0);
    }

    /**
     * Recursively print folder summary
     * @param {Object} folders - Folders object
     * @param {number} indent - Indentation level
     */
    printFolderSummary(folders, indent = 0) {
        const indentStr = '  '.repeat(indent);
        
        Object.entries(folders).forEach(([folderName, folderId]) => {
            console.log(`${indentStr}📁 ${folderName}: ${folderId}`);
        });
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
        this.scannedFolders.clear();
        console.log('🗑️ Cache cleared');
    }
}

// Main execution function
async function main() {
    const scanner = new GoogleDriveCacheScanner();
    
    try {
        // Initialize the scanner
        const initialized = await scanner.initialize();
        if (!initialized) {
            process.exit(1);
        }

        // Get parent folder ID from environment variables
        const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.FOLDER_ID;
        if (!parentFolderId) {
            console.log('❌ Please set the GOOGLE_DRIVE_FOLDER_ID or FOLDER_ID environment variable');
            console.log('Usage: Set environment variable in .env file or export it:');
            console.log('  export GOOGLE_DRIVE_FOLDER_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"');
            console.log('  node cache.js');
            console.log('');
            console.log('Or create a .env file with:');
            console.log('  GOOGLE_DRIVE_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
            process.exit(1);
        }

        // Scan the parent folder
        const results = await scanner.scanParentFolder(parentFolderId);
        
        // Print summary
        scanner.printSummary(results);
        
        // Save results to file
        const outputFilename = process.env.OUTPUT_FILENAME || 'scan_results.json';
        await scanner.saveResults(results, outputFilename);
        
        console.log('\n✅ Scan completed successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Export the class for use in other modules
module.exports = GoogleDriveCacheScanner;

// Run the script if called directly
if (require.main === module) {
    main();
}