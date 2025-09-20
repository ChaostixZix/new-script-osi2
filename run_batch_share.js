#!/usr/bin/env node

const BatchShareManager = require('./share_peserta_folder_batch');
const BatchMonitor = require('./monitor_batch');
const { spawn } = require('child_process');
const path = require('path');

class BatchRunner {
    constructor() {
        this.batchManager = new BatchShareManager();
        this.monitor = new BatchMonitor();
    }

    /**
     * Run batch processing with monitoring
     */
    async runWithMonitoring() {
        console.log('🚀 Starting Batch Folder Sharing with Real-time Monitoring');
        console.log('==========================================================\n');
        
        try {
            // Start monitoring in a separate process
            const monitorProcess = spawn('node', [path.join(__dirname, 'monitor_batch.js')], {
                stdio: 'inherit',
                detached: false
            });

            // Give monitor a moment to start
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Run batch processing
            await this.runBatchProcessing();

            // Wait a moment for monitoring to catch up
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Kill monitor process
            monitorProcess.kill();

            console.log('\n✅ Batch processing completed successfully!');
            console.log('📊 Check batch_monitoring.json for detailed metrics');
            console.log('📋 Check share_peserta_folder_batch.json for results');

        } catch (error) {
            console.error('❌ Batch processing failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Run batch processing without monitoring
     */
    async runBatchProcessing() {
        try {
            // Initialize the batch manager
            const initialized = await this.batchManager.initialize();
            if (!initialized) {
                throw new Error('Failed to initialize Google APIs');
            }

            // Load cached participants
            this.batchManager.loadCachedParticipants();
            
            // Load scan results
            this.batchManager.loadScanResults();
            
            // Process sharing with workers
            await this.batchManager.processSharingWithWorkers();
            
            // Prepare batch updates
            this.batchManager.prepareBatchUpdates();
            
            // Save sharing results
            await this.batchManager.saveShareResults();
            
            // Save monitoring data
            await this.batchManager.saveMonitoringData();
            
            // Update Google Sheets
            await this.batchManager.updateSheets();
            
            // Print summary
            this.batchManager.printSummary();

        } catch (error) {
            console.error('❌ Error in batch processing:', error.message);
            throw error;
        }
    }

    /**
     * Run batch processing only (no monitoring)
     */
    async runOnly() {
        console.log('🚀 Starting Batch Folder Sharing');
        console.log('=================================\n');
        
        try {
            await this.runBatchProcessing();
            console.log('\n✅ Batch processing completed successfully!');
        } catch (error) {
            console.error('❌ Batch processing failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Display help information
     */
    displayHelp() {
        console.log('📖 Batch Folder Sharing Tool');
        console.log('============================');
        console.log('');
        console.log('Usage:');
        console.log('  node run_batch_share.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --monitor, -m    Run with real-time monitoring (default)');
        console.log('  --only, -o       Run batch processing only (no monitoring)');
        console.log('  --help, -h       Show this help message');
        console.log('');
        console.log('Configuration:');
        console.log('  Set WORKER_COUNT and BATCH_SIZE in batch_config.env');
        console.log('  Default: WORKER_COUNT=4, BATCH_SIZE=10');
        console.log('');
        console.log('Files:');
        console.log('  - batch_monitoring.json     Real-time monitoring data');
        console.log('  - share_peserta_folder_batch.json  Detailed results');
        console.log('  - cache_peserta.json        Required: participant data');
        console.log('  - scan_results.json         Required: folder scan results');
        console.log('  - service.json              Required: Google service account');
    }
}

// Main execution
async function main() {
    const runner = new BatchRunner();
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        runner.displayHelp();
        return;
    }
    
    if (args.includes('--only') || args.includes('-o')) {
        await runner.runOnly();
    } else {
        // Default: run with monitoring
        await runner.runWithMonitoring();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = BatchRunner;