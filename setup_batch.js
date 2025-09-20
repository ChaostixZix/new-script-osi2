#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

class BatchSetup {
    constructor() {
        this.configFile = path.join(__dirname, 'batch_config.env');
        this.envFile = path.join(__dirname, '.env');
    }

    /**
     * Setup batch configuration
     */
    async setup() {
        console.log('🔧 Setting up Batch Folder Sharing System');
        console.log('==========================================\n');

        try {
            // Check required files
            this.checkRequiredFiles();

            // Create configuration
            await this.createConfiguration();

            // Update .env file
            await this.updateEnvFile();

            // Display summary
            this.displaySummary();

            console.log('\n✅ Setup completed successfully!');
            console.log('🚀 Run: node run_batch_share.js --monitor');

        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Check if required files exist
     */
    checkRequiredFiles() {
        console.log('📋 Checking required files...');

        const requiredFiles = [
            'service.json',
            'cache_peserta.json',
            'scan_results.json'
        ];

        const missingFiles = [];

        requiredFiles.forEach(file => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                console.log(`✅ ${file}`);
            } else {
                console.log(`❌ ${file} - MISSING`);
                missingFiles.push(file);
            }
        });

        if (missingFiles.length > 0) {
            console.log('\n⚠️  Missing required files:');
            missingFiles.forEach(file => {
                console.log(`   - ${file}`);
            });
            console.log('\nPlease ensure all required files are present before running batch processing.');
        }

        console.log('');
    }

    /**
     * Create batch configuration
     */
    async createConfiguration() {
        console.log('⚙️  Creating batch configuration...');

        const cpuCount = os.cpus().length;
        const recommendedWorkers = Math.min(4, cpuCount);
        const recommendedBatchSize = 10;

        const config = `# Batch Processing Configuration
# Generated on ${new Date().toISOString()}

# Number of worker threads to use
# Recommended: ${recommendedWorkers} (based on ${cpuCount} CPU cores)
# Range: 1-8 (higher = faster but more API calls)
WORKER_COUNT=${recommendedWorkers}

# Number of participants to process in each batch
# Recommended: ${recommendedBatchSize}
# Range: 5-50 (higher = more memory usage)
BATCH_SIZE=${recommendedBatchSize}

# Rate limiting delay between API calls (milliseconds)
# Recommended: 100ms
# Range: 50-500ms (lower = faster but may hit rate limits)
API_DELAY=100

# Google Sheets Configuration
# Set these in your .env file
# GOOGLE_SHEET_ID=your_sheet_id_here
# WORKSHEET_NAME=Form Response 1

# Performance Tips:
# - For API rate limits: Increase API_DELAY or decrease WORKER_COUNT
# - For memory issues: Decrease BATCH_SIZE or WORKER_COUNT
# - For maximum speed: Increase WORKER_COUNT (but watch rate limits)
`;

        fs.writeFileSync(this.configFile, config);
        console.log(`✅ Configuration saved to: ${this.configFile}`);
    }

    /**
     * Update .env file with batch settings
     */
    async updateEnvFile() {
        console.log('📝 Updating .env file...');

        let envContent = '';
        if (fs.existsSync(this.envFile)) {
            envContent = fs.readFileSync(this.envFile, 'utf8');
        }

        // Add batch configuration to .env if not present
        const batchConfigs = [
            'WORKER_COUNT',
            'BATCH_SIZE',
            'API_DELAY'
        ];

        let updated = false;
        batchConfigs.forEach(config => {
            if (!envContent.includes(config)) {
                envContent += `\n# Batch Processing Configuration\n`;
                envContent += `${config}=${this.getDefaultValue(config)}\n`;
                updated = true;
            }
        });

        if (updated) {
            fs.writeFileSync(this.envFile, envContent);
            console.log(`✅ Updated .env file with batch configuration`);
        } else {
            console.log(`✅ .env file already contains batch configuration`);
        }
    }

    /**
     * Get default value for configuration
     */
    getDefaultValue(config) {
        switch (config) {
            case 'WORKER_COUNT':
                return Math.min(4, os.cpus().length);
            case 'BATCH_SIZE':
                return 10;
            case 'API_DELAY':
                return 100;
            default:
                return '';
        }
    }

    /**
     * Display setup summary
     */
    displaySummary() {
        console.log('\n📊 SETUP SUMMARY');
        console.log('================');
        console.log(`💻 CPU Cores: ${os.cpus().length}`);
        console.log(`👥 Recommended Workers: ${Math.min(4, os.cpus().length)}`);
        console.log(`📦 Recommended Batch Size: 10`);
        console.log(`⏱️  API Delay: 100ms`);
        console.log('');
        console.log('📁 Files Created:');
        console.log('  - batch_config.env (configuration)');
        console.log('  - .env (updated with batch settings)');
        console.log('');
        console.log('🚀 Next Steps:');
        console.log('  1. Review batch_config.env settings');
        console.log('  2. Set GOOGLE_SHEET_ID in .env');
        console.log('  3. Run: node run_batch_share.js --monitor');
        console.log('');
        console.log('📖 For more info: README_BATCH.md');
    }

    /**
     * Display help
     */
    displayHelp() {
        console.log('🔧 Batch Setup Tool');
        console.log('===================');
        console.log('');
        console.log('Usage:');
        console.log('  node setup_batch.js');
        console.log('');
        console.log('This tool will:');
        console.log('  - Check required files');
        console.log('  - Create batch configuration');
        console.log('  - Update .env file');
        console.log('  - Display setup summary');
        console.log('');
        console.log('Required files:');
        console.log('  - service.json (Google service account)');
        console.log('  - cache_peserta.json (participant data)');
        console.log('  - scan_results.json (folder scan results)');
    }
}

// Main execution
async function main() {
    const setup = new BatchSetup();
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        setup.displayHelp();
        return;
    }
    
    await setup.setup();
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = BatchSetup;