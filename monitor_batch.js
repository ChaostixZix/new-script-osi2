const fs = require('fs');
const path = require('path');

class BatchMonitor {
    constructor() {
        this.monitoringFile = path.join(__dirname, 'batch_monitoring.json');
        this.isMonitoring = false;
        this.intervalId = null;
    }

    /**
     * Start monitoring batch processing
     */
    startMonitoring() {
        console.log('🔍 Starting batch processing monitor...');
        console.log('Press Ctrl+C to stop monitoring\n');
        
        this.isMonitoring = true;
        this.intervalId = setInterval(() => {
            this.displayStatus();
        }, 2000); // Update every 2 seconds
        
        // Display initial status
        this.displayStatus();
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isMonitoring = false;
        console.log('\n👋 Monitoring stopped');
    }

    /**
     * Display current batch processing status
     */
    displayStatus() {
        try {
            if (!fs.existsSync(this.monitoringFile)) {
                console.log('⏳ Waiting for batch processing to start...');
                return;
            }

            const monitoringData = JSON.parse(fs.readFileSync(this.monitoringFile, 'utf8'));
            
            // Clear console and display status
            console.clear();
            this.displayHeader();
            this.displayOverallProgress(monitoringData);
            this.displayWorkerStatus(monitoringData);
            this.displayTiming(monitoringData);
            
            // Stop monitoring if processing is completed
            if (monitoringData.status === 'completed') {
                this.stopMonitoring();
                console.log('\n✅ Batch processing completed!');
            }
            
        } catch (error) {
            console.error('❌ Error reading monitoring data:', error.message);
        }
    }

    /**
     * Display header
     */
    displayHeader() {
        console.log('📊 BATCH PROCESSING MONITOR');
        console.log('============================');
        console.log(`🕐 ${new Date().toLocaleString()}`);
        console.log('');
    }

    /**
     * Display overall progress
     */
    displayOverallProgress(data) {
        const progress = data.progress || 0;
        const progressBar = this.createProgressBar(progress);
        
        console.log('📈 OVERALL PROGRESS');
        console.log('------------------');
        console.log(`${progressBar} ${progress}%`);
        console.log(`📊 Status: ${data.status || 'unknown'}`);
        console.log(`📝 Total Tasks: ${data.totalTasks || 0}`);
        console.log(`✅ Completed: ${data.completedTasks || 0}`);
        console.log(`❌ Failed: ${data.failedTasks || 0}`);
        
        if (data.summary) {
            console.log(`🎯 Success Rate: ${data.summary.successRate || 0}%`);
        }
        console.log('');
    }

    /**
     * Display worker status
     */
    displayWorkerStatus(data) {
        console.log('👥 WORKER STATUS');
        console.log('----------------');
        
        if (!data.workers || data.workers.length === 0) {
            console.log('No workers active');
            return;
        }

        data.workers.forEach((worker, index) => {
            const status = this.getStatusEmoji(worker.status);
            console.log(`Worker ${index}: ${status} ${worker.status} | ✅ ${worker.processedTasks || 0} | ❌ ${worker.failedTasks || 0}`);
        });
        console.log('');
    }

    /**
     * Display timing information
     */
    displayTiming(data) {
        console.log('⏱️  TIMING');
        console.log('----------');
        
        if (data.startTime) {
            const startTime = new Date(data.startTime);
            console.log(`🚀 Started: ${startTime.toLocaleTimeString()}`);
            
            if (data.endTime) {
                const endTime = new Date(data.endTime);
                const duration = data.duration || (endTime - startTime);
                console.log(`🏁 Finished: ${endTime.toLocaleTimeString()}`);
                console.log(`⏱️  Duration: ${Math.round(duration / 1000)} seconds`);
            } else {
                const elapsed = Date.now() - startTime.getTime();
                console.log(`⏱️  Elapsed: ${Math.round(elapsed / 1000)} seconds`);
            }
        }
        console.log('');
    }

    /**
     * Create a visual progress bar
     */
    createProgressBar(progress, width = 30) {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    }

    /**
     * Get status emoji for worker
     */
    getStatusEmoji(status) {
        switch (status) {
            case 'idle': return '😴';
            case 'ready': return '🟢';
            case 'processing': return '⚙️';
            case 'error': return '❌';
            default: return '❓';
        }
    }

    /**
     * Display final summary
     */
    displayFinalSummary() {
        try {
            if (!fs.existsSync(this.monitoringFile)) {
                console.log('No monitoring data found');
                return;
            }

            const monitoringData = JSON.parse(fs.readFileSync(this.monitoringFile, 'utf8'));
            
            console.log('\n📋 FINAL SUMMARY');
            console.log('================');
            console.log(`📊 Total Tasks: ${monitoringData.totalTasks}`);
            console.log(`✅ Completed: ${monitoringData.completedTasks}`);
            console.log(`❌ Failed: ${monitoringData.failedTasks}`);
            console.log(`🎯 Success Rate: ${monitoringData.summary?.successRate || 0}%`);
            console.log(`⏱️  Total Duration: ${Math.round(monitoringData.duration / 1000)} seconds`);
            console.log(`👥 Workers Used: ${monitoringData.workers?.length || 0}`);
            
        } catch (error) {
            console.error('❌ Error displaying final summary:', error.message);
        }
    }
}

// Main execution
function main() {
    const monitor = new BatchMonitor();
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        monitor.stopMonitoring();
        monitor.displayFinalSummary();
        process.exit(0);
    });
    
    // Start monitoring
    monitor.startMonitoring();
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = BatchMonitor;