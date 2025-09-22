const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store active processes
const activeProcesses = new Map();

// Helper function to check file existence
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

// Helper function to get file stats
function getFileStats(filePath) {
    if (!fileExists(filePath)) return null;
    const stats = fs.statSync(filePath);
    return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.ctime
    };
}

// API: Get system status
app.get('/api/status', (req, res) => {
    const status = {
        scanResults: {
            exists: fileExists('./scan_results.json'),
            stats: getFileStats('./scan_results.json'),
            data: null
        },
        cacheResults: {
            exists: fileExists('./cache_peserta.json'),
            stats: getFileStats('./cache_peserta.json'),
            data: null
        },
        shareResults: {
            exists: fileExists('./monitor_share_results.json'),
            stats: getFileStats('./monitor_share_results.json'),
            data: null
        },
        historyFile: {
            exists: fileExists('./monitor_share_history.json'),
            stats: getFileStats('./monitor_share_history.json')
        },
        activeProcesses: Array.from(activeProcesses.keys()),
        environment: {
            hasSheetId: !!process.env.GOOGLE_SHEET_ID,
            hasWorksheet: !!process.env.WORKSHEET_NAME,
            hasFolderId: !!process.env.FOLDER_ID,
            hasServiceAccount: fileExists('./service.json')
        }
    };

    // Load data if files exist
    try {
        if (status.scanResults.exists) {
            const scanData = JSON.parse(fs.readFileSync('./scan_results.json', 'utf8'));
            status.scanResults.data = {
                totalFolders: Object.keys(scanData).length,
                folders: Object.keys(scanData).slice(0, 10) // First 10 folders
            };
        }
    } catch (e) {}

    try {
        if (status.cacheResults.exists) {
            const cacheData = JSON.parse(fs.readFileSync('./cache_peserta.json', 'utf8'));
            status.cacheResults.data = {
                totalParticipants: cacheData.totalParticipants,
                timestamp: cacheData.timestamp,
                unsharedCount: cacheData.participants ? 
                    cacheData.participants.filter(p => !p.isShared).length : 0
            };
        }
    } catch (e) {}

    try {
        if (status.shareResults.exists) {
            const shareData = JSON.parse(fs.readFileSync('./monitor_share_results.json', 'utf8'));
            status.shareResults.data = shareData.statistics;
        }
    } catch (e) {}

    res.json(status);
});

// API: Get configuration
app.get('/api/config', (req, res) => {
    res.json({
        GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
        WORKSHEET_NAME: process.env.WORKSHEET_NAME || '',
        FOLDER_ID: process.env.FOLDER_ID || '',
        WORKER_COUNT: process.env.WORKER_COUNT || '4',
        BATCH_SIZE: process.env.BATCH_SIZE || '10',
        OUTPUT_FILENAME: process.env.OUTPUT_FILENAME || 'scan_results.json'
    });
});

// API: Update configuration
app.post('/api/config', (req, res) => {
    const config = req.body;
    const envContent = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    fs.writeFileSync('.env', envContent);
    
    // Reload environment variables
    require('dotenv').config({ override: true });
    
    res.json({ success: true, message: 'Configuration updated' });
});

// API: Run scan process
app.post('/api/scan', (req, res) => {
    if (activeProcesses.has('scan')) {
        return res.status(400).json({ error: 'Scan process already running' });
    }

    const scanProcess = spawn('node', ['scan_folder.js']);
    activeProcesses.set('scan', scanProcess);

    scanProcess.stdout.on('data', (data) => {
        io.emit('scan:output', data.toString());
    });

    scanProcess.stderr.on('data', (data) => {
        io.emit('scan:error', data.toString());
    });

    scanProcess.on('close', (code) => {
        activeProcesses.delete('scan');
        io.emit('scan:complete', { code });
        if (code === 0) {
            io.emit('status:update');
        }
    });

    res.json({ success: true, message: 'Scan process started' });
});

// API: Run cache process
app.post('/api/cache', (req, res) => {
    if (activeProcesses.has('cache')) {
        return res.status(400).json({ error: 'Cache process already running' });
    }

    const cacheProcess = spawn('node', ['cache_peserta.js']);
    activeProcesses.set('cache', cacheProcess);

    cacheProcess.stdout.on('data', (data) => {
        io.emit('cache:output', data.toString());
    });

    cacheProcess.stderr.on('data', (data) => {
        io.emit('cache:error', data.toString());
    });

    cacheProcess.on('close', (code) => {
        activeProcesses.delete('cache');
        io.emit('cache:complete', { code });
        if (code === 0) {
            io.emit('status:update');
        }
    });

    res.json({ success: true, message: 'Cache process started' });
});

// API: Run share process
app.post('/api/share', (req, res) => {
    if (activeProcesses.has('share')) {
        return res.status(400).json({ error: 'Share process already running' });
    }

    const shareProcess = spawn('node', ['monitor_share.js']);
    activeProcesses.set('share', shareProcess);

    shareProcess.stdout.on('data', (data) => {
        const output = data.toString();
        io.emit('share:output', output);
        
        // Enhanced parsing for monitor_share output - New web-friendly format
        let processed = 0;
        let total = 0;
        let successful = 0;
        let failed = 0;
        let activeWorkers = 0;
        let workerCount = 0;
        
        // Parse PROGRESS: Processed X / Y (Z%)
        const progressMatch = output.match(/PROGRESS:\s*Processed\s*(\d+)\s*\/\s*(\d+)\s*\(([\d.]+)%\)/i);
        if (progressMatch) {
            processed = parseInt(progressMatch[1]);
            total = parseInt(progressMatch[2]);
        }
        
        // Parse STATUS: X successful, Y failed, Z errors
        const statusMatch = output.match(/STATUS:\s*(\d+)\s*successful,\s*(\d+)\s*failed,\s*(\d+)\s*errors/i);
        if (statusMatch) {
            successful = parseInt(statusMatch[1]);
            failed = parseInt(statusMatch[2]);
        }
        
        // Parse WORKERS: X/Y active, Z in queue
        const workersMatch = output.match(/WORKERS:\s*(\d+)\/(\d+)\s*active/i);
        if (workersMatch) {
            activeWorkers = parseInt(workersMatch[1]);
            workerCount = parseInt(workersMatch[2]);
        }
        
        // Parse SPEED: X per second, ETA: Y
        const speedMatch = output.match(/SPEED:\s*([\d.]+)\s*per\s*second/i);
        if (speedMatch) {
            io.emit('share:speed', {
                speed: parseFloat(speedMatch[1]),
                unit: 'second',
                timestamp: Date.now()
            });
        }
        
        // Parse SPEED_UPDATE JSON format
        const speedUpdateMatch = output.match(/SPEED_UPDATE:\s*(\{.*\})/i);
        if (speedUpdateMatch) {
            try {
                const speedData = JSON.parse(speedUpdateMatch[1]);
                io.emit('share:speed', {
                    speed: speedData.speed,
                    unit: speedData.unit,
                    processed: speedData.processed,
                    total: speedData.total,
                    successful: speedData.successful,
                    failed: speedData.failed,
                    activeWorkers: speedData.activeWorkers,
                    workerCount: speedData.workerCount,
                    eta: speedData.eta,
                    timestamp: Date.now()
                });
                // Also emit progress update
                io.emit('share:progress', {
                    processed: speedData.processed,
                    total: speedData.total,
                    successful: speedData.successful,
                    failed: speedData.failed,
                    activeWorkers: speedData.activeWorkers,
                    workerCount: speedData.workerCount,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.error('Error parsing speed update:', e);
            }
        }
        
        // Parse PROGRESS_START: Total=X, Workers=Y
        const startMatch = output.match(/PROGRESS_START:\s*Total=(\d+),\s*Workers=(\d+)/i);
        if (startMatch) {
            total = parseInt(startMatch[1]);
            workerCount = parseInt(startMatch[2]);
        }
        
        // Parse FINAL_STATS
        const finalMatch = output.match(/FINAL_STATS:\s*Processed=(\d+),\s*Successful=(\d+),\s*Failed=(\d+),\s*Time=(\d+)s,\s*Speed=([\d.]+)\/s/i);
        if (finalMatch) {
            processed = parseInt(finalMatch[1]);
            successful = parseInt(finalMatch[2]);
            failed = parseInt(finalMatch[3]);
            const totalTime = parseInt(finalMatch[4]);
            const finalSpeed = parseFloat(finalMatch[5]);
            
            io.emit('share:speed', {
                speed: finalSpeed,
                unit: 'second',
                timestamp: Date.now()
            });
        }
        
        // Parse DASHBOARD_UPDATE for real-time stats
        const dashboardMatch = output.match(/DASHBOARD_UPDATE:\s*(\{[\s\S]*?\})/i);
        if (dashboardMatch) {
            try {
                const dashboardData = JSON.parse(dashboardMatch[1]);
                io.emit('dashboard:update', dashboardData);
            } catch (e) {
                console.error('Error parsing dashboard update:', e);
            }
        }
        
        // Parse RESULTS_UPDATE for detailed issues table
        const resultsMatch = output.match(/RESULTS_UPDATE:\s*(\{[\s\S]*?\})/i);
        if (resultsMatch) {
            try {
                // Try to parse the JSON
                const jsonStr = resultsMatch[1];
                // Validate JSON string first
                if (jsonStr.length > 100000) { // 100KB limit
                    throw new Error('JSON data too large');
                }
                const resultsData = JSON.parse(jsonStr);
                io.emit('results:update', resultsData);
            } catch (e) {
                console.error('Error parsing results update:', e.message);
                // Send a safe fallback data
                io.emit('results:update', {
                    totalIssues: 0,
                    noFolder: 0,
                    emailIssues: 0,
                    permissionIssues: 0,
                    detailedIssues: [],
                    error: 'Data too large to display'
                });
            }
        }
        
        // Parse worker status from new format
        const workerStatusMatch = output.match(/WORKER_STATUS:\s*Worker\s*(\d+)\s*is\s*now\s*(\w+)/i);
        if (workerStatusMatch) {
            io.emit('share:workerStatus', {
                workerId: parseInt(workerStatusMatch[1]),
                status: workerStatusMatch[2].toLowerCase(),
                timestamp: Date.now()
            });
        }
        
        // Parse worker working on specific task
        const workerWorkingMatch = output.match(/WORKER_STATUS:\s*Worker\s*(\d+)\s*is\s*now\s*working\s*on\s*(.+)/i);
        if (workerWorkingMatch) {
            io.emit('share:workerStatus', {
                workerId: parseInt(workerWorkingMatch[1]),
                status: 'working',
                task: workerWorkingMatch[2],
                timestamp: Date.now()
            });
        }
        
        // Fallback to old patterns for compatibility
        if (processed === 0) {
            const oldPatterns = [
                /Processed\s+(\d+)\s*\/\s*(\d+)/i,
                /Processed\s+(\d+)\s+of\s+(\d+)/i,
                /Progress:\s*(\d+)\s*\/\s*(\d+)/i,
                /(\d+)\s*\/\s*(\d+)\s*processed/i
            ];
            
            for (const pattern of oldPatterns) {
                const match = output.match(pattern);
                if (match) {
                    processed = parseInt(match[1]);
                    total = parseInt(match[2]);
                    break;
                }
            }
        }
        
        // Emit progress if we have valid data
        if (processed > 0 && total > 0) {
            console.log(`DEBUG: Emitting progress - Processed: ${processed}, Total: ${total}, Success: ${successful}, Failed: ${failed}`);
            io.emit('share:progress', {
                processed: processed,
                total: total,
                successful: successful,
                failed: failed,
                activeWorkers: activeWorkers,
                workerCount: workerCount,
                timestamp: Date.now()
            });
        }
        
        // Parse individual worker patterns (fallback)
        if (output.includes('Worker') || output.includes('worker')) {
            const workerMatch = output.match(/(?:Worker|worker)\s*(\d+):\s*(\w+)/i);
            if (workerMatch) {
                io.emit('share:workerStatus', {
                    workerId: parseInt(workerMatch[1]),
                    status: workerMatch[2].toLowerCase(),
                    timestamp: Date.now()
                });
            }
        }
    });

    shareProcess.stderr.on('data', (data) => {
        io.emit('share:error', data.toString());
    });

    shareProcess.on('close', (code) => {
        activeProcesses.delete('share');
        io.emit('share:complete', { code });
        if (code === 0) {
            io.emit('status:update');
        }
    });

    res.json({ success: true, message: 'Share process started' });
});

// API: Stop process
app.post('/api/stop/:process', (req, res) => {
    const processName = req.params.process;
    if (activeProcesses.has(processName)) {
        const process = activeProcesses.get(processName);
        process.kill('SIGTERM');
        activeProcesses.delete(processName);
        res.json({ success: true, message: `${processName} process stopped` });
    } else {
        res.status(404).json({ error: 'Process not found' });
    }
});

// API: Get logs
app.get('/api/logs/:type', (req, res) => {
    const type = req.params.type;
    const files = {
        share: './monitor_share_results.json',
        history: './monitor_share_history.json',
        scan: './scan_results.json',
        cache: './cache_peserta.json'
    };

    const filePath = files[type];
    if (!filePath || !fileExists(filePath)) {
        return res.status(404).json({ error: 'Log file not found' });
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read log file' });
    }
});

// API: Clear history
app.delete('/api/history', (req, res) => {
    const historyFile = './monitor_share_history.json';
    if (fileExists(historyFile)) {
        fs.unlinkSync(historyFile);
        res.json({ success: true, message: 'History cleared' });
    } else {
        res.status(404).json({ error: 'History file not found' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📊 Dashboard available at http://${HOST}:${PORT}`);
});