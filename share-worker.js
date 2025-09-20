const { parentPort, workerData } = require('worker_threads');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class ShareWorker {
    constructor() {
        this.drive = null;
        this.workerId = workerData.workerId;
    }

    async initialize() {
        try {
            const serviceAccountPath = path.join(__dirname, 'service.json');
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

            const auth = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                serviceAccount.private_key,
                ['https://www.googleapis.com/auth/drive']
            );

            this.drive = google.drive({ version: 'v3', auth });

            parentPort.postMessage({
                type: 'initialized',
                workerId: this.workerId
            });

            return true;
        } catch (error) {
            parentPort.postMessage({
                type: 'error',
                workerId: this.workerId,
                error: error.message
            });
            return false;
        }
    }

    async shareFolder(task) {
        try {
            const { folderId, email, participant } = task;

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

            parentPort.postMessage({
                type: 'success',
                workerId: this.workerId,
                result: {
                    success: true,
                    permissionId: response.data.id,
                    folderId,
                    email,
                    participant
                }
            });

        } catch (error) {
            parentPort.postMessage({
                type: 'error',
                workerId: this.workerId,
                result: {
                    success: false,
                    error: error.message,
                    errorCode: error.code || 'UNKNOWN',
                    folderId: task.folderId,
                    email: task.email,
                    participant: task.participant
                }
            });
        }
    }
}

// Initialize worker
const worker = new ShareWorker();

parentPort.on('message', async (message) => {
    switch (message.type) {
        case 'init':
            await worker.initialize();
            break;
        case 'share':
            await worker.shareFolder(message.task);
            break;
        case 'terminate':
            process.exit(0);
            break;
    }
});

// Handle worker termination
process.on('SIGTERM', () => {
    process.exit(0);
});

process.on('SIGINT', () => {
    process.exit(0);
});