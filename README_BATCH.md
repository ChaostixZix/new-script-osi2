# Batch Folder Sharing System

Sistem batch processing untuk sharing folder Google Drive dengan multiple workers dan monitoring real-time.

## Features

- **Multiple Workers**: Parallel processing dengan worker threads
- **Real-time Monitoring**: Progress tracking dan status monitoring
- **Batch Processing**: Mengelompokkan tasks untuk efisiensi
- **Error Handling**: Robust error handling dan retry mechanism
- **Performance Metrics**: Detailed monitoring dan analytics

## Files

- `share_peserta_folder_batch.js` - Main batch processing system
- `run_batch_share.js` - Runner script dengan monitoring
- `monitor_batch.js` - Real-time monitoring tool
- `batch_config.env` - Configuration file

## Setup

1. **Install Dependencies**:
   ```bash
   npm install googleapis dotenv
   ```

2. **Configuration**:
   - Copy `batch_config.env` dan sesuaikan settings
   - Set `WORKER_COUNT` (default: 4)
   - Set `BATCH_SIZE` (default: 10)

3. **Required Files**:
   - `service.json` - Google service account credentials
   - `cache_peserta.json` - Participant data
   - `scan_results.json` - Folder scan results

## Usage

### Run dengan Monitoring (Recommended)
```bash
node run_batch_share.js --monitor
# atau
node run_batch_share.js
```

### Run Tanpa Monitoring
```bash
node run_batch_share.js --only
```

### Monitor Terpisah
```bash
node monitor_batch.js
```

## Configuration

### Environment Variables
```env
WORKER_COUNT=4          # Number of worker threads
BATCH_SIZE=10           # Participants per batch
API_DELAY=100           # Delay between API calls (ms)
GOOGLE_SHEET_ID=xxx     # Google Sheets ID
WORKSHEET_NAME=xxx      # Worksheet name
```

### Worker Count Guidelines
- **CPU Intensive**: Use `os.cpus().length`
- **API Rate Limited**: Use 2-4 workers
- **Memory Constrained**: Use 2-3 workers
- **Default**: 4 workers atau CPU cores (whichever smaller)

## Output Files

### batch_monitoring.json
```json
{
  "startTime": "2024-01-01T10:00:00.000Z",
  "endTime": "2024-01-01T10:05:00.000Z",
  "totalTasks": 100,
  "completedTasks": 95,
  "failedTasks": 5,
  "progress": 100,
  "status": "completed",
  "workers": [...],
  "summary": {
    "successRate": 95
  }
}
```

### share_peserta_folder_batch.json
```json
{
  "timestamp": "2024-01-01T10:05:00.000Z",
  "totalProcessed": 100,
  "successfulShares": 95,
  "failedShares": 5,
  "failedResults": [...],
  "successfulSummary": [...],
  "monitoring": {...}
}
```

## Performance

### Expected Performance
- **Single Thread**: ~100 participants/minute
- **4 Workers**: ~300-400 participants/minute
- **8 Workers**: ~500-600 participants/minute

### Rate Limiting
- Google Drive API: 100 requests/100 seconds per user
- Default delay: 100ms between requests
- Adjust `API_DELAY` if hitting rate limits

## Monitoring

### Real-time Display
```
📊 BATCH PROCESSING MONITOR
============================
🕐 2024-01-01 10:02:30

📈 OVERALL PROGRESS
------------------
[████████████████████████████████] 75%
📊 Status: processing
📝 Total Tasks: 100
✅ Completed: 75
❌ Failed: 0
🎯 Success Rate: 100%

👥 WORKER STATUS
----------------
Worker 0: ⚙️ processing | ✅ 20 | ❌ 0
Worker 1: ⚙️ processing | ✅ 18 | ❌ 0
Worker 2: ⚙️ processing | ✅ 19 | ❌ 0
Worker 3: ⚙️ processing | ✅ 18 | ❌ 0

⏱️  TIMING
----------
🚀 Started: 10:00:00
⏱️  Elapsed: 150 seconds
```

## Error Handling

### Worker Failures
- Automatic worker restart
- Failed tasks logged for retry
- Graceful degradation

### API Errors
- Rate limit handling
- Retry mechanism
- Error logging

### Recovery
- Failed shares saved in JSON
- Can retry failed shares only
- Resume from last checkpoint

## Troubleshooting

### Common Issues

1. **Rate Limiting**:
   - Increase `API_DELAY`
   - Reduce `WORKER_COUNT`

2. **Memory Issues**:
   - Reduce `WORKER_COUNT`
   - Reduce `BATCH_SIZE`

3. **Worker Failures**:
   - Check `service.json` permissions
   - Verify network connectivity

### Debug Mode
```bash
DEBUG=* node run_batch_share.js
```

## Comparison

| Feature | Original | Batch System |
|---------|----------|--------------|
| Processing | Sequential | Parallel |
| Speed | ~100/min | ~400/min |
| Monitoring | Basic | Real-time |
| Error Handling | Basic | Advanced |
| Scalability | Limited | High |
| Resource Usage | Low | Medium |

## Best Practices

1. **Start Small**: Test with small batch first
2. **Monitor Resources**: Watch CPU/memory usage
3. **Adjust Workers**: Based on API limits
4. **Save Progress**: Regular checkpoints
5. **Handle Failures**: Retry failed shares