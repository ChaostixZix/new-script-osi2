# Script yang sekarang dipake
- scan_folder.js -> buat cache scan folder id
- monitor_share.js -> buat share batch dengna monitor table
- cache_peserta.js -> untuk membuat cache dari google sheet dengan nama peserta

# Google Drive Cache Scanner

A Node.js script that uses Google APIs to scan parent folder's children with 2 depth levels and caches the results for efficient access.

## Features

- 🔍 Scans Google Drive folders up to 2 depth levels
- 💾 Intelligent caching system to avoid redundant API calls
- 📊 Detailed logging and progress tracking
- 🛡️ Error handling and recovery
- 📄 Saves results to JSON file
- 🚀 Easy to use command-line interface

## Prerequisites

1. **Google Service Account**: You need a Google Cloud service account with Drive API access
2. **service.json**: Place your service account credentials file in the root directory
3. **Node.js**: Make sure Node.js is installed on your system

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get Google Service Account Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Drive API
   - Create a service account
   - Download the JSON key file and rename it to `service.json`
   - Place `service.json` in the root directory of this project

3. **Grant Permissions**:
   - Share the Google Drive folders you want to scan with your service account email
   - The service account email can be found in the `service.json` file

4. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set your Google Drive folder ID:
     ```
     GOOGLE_DRIVE_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
     ```

## Usage

### Basic Usage

```bash
node cache.js
```

The script will automatically read the folder ID from your `.env` file.

### Alternative: Using Environment Variables Directly

```bash
export GOOGLE_DRIVE_FOLDER_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
node cache.js
```

### Using npm start

```bash
npm start
```

### How to Get Folder ID

1. Open Google Drive in your browser
2. Navigate to the folder you want to scan
3. Copy the folder ID from the URL:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID_HERE
   ```
4. Add it to your `.env` file:
   ```
   GOOGLE_DRIVE_FOLDER_ID=FOLDER_ID_HERE
   ```

### Environment Variables

The script supports the following environment variables:

- `GOOGLE_DRIVE_FOLDER_ID` or `FOLDER_ID`: The Google Drive folder ID to scan (required)
- `OUTPUT_FILENAME`: Custom filename for the scan results (optional, defaults to `scan_results.json`)

## Output

The script will:

1. **Display progress** in the console with detailed logging
2. **Show a summary** of the scan results
3. **Save results** to `scan_results.json` file

### Sample Output

```
✅ Google Drive API initialized successfully
🚀 Starting scan of parent folder: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
📊 Maximum depth: 2 levels
🔍 Scanning folder 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms at depth 0
📁 Found subfolder: Documents (ID: 1ABC123...)
🔍 Scanning folder 1ABC123... at depth 1
📁 Found subfolder: Projects (ID: 1DEF456...)
🔍 Scanning folder 1DEF456... at depth 2
✅ Scanned 15 items in folder 1DEF456... at depth 2
✅ Scanned 8 items in folder 1ABC123... at depth 1
✅ Scanned 25 items in folder 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms at depth 0
🎉 Scan completed in 1250ms
📈 Total folders scanned: 3
💾 Cache entries: 3

📋 SCAN SUMMARY
================
Parent Folder ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
Scan Duration: 1250ms
Folders Scanned: 3
Cache Entries: 3
📁 Folder: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms (Depth: 0)
  📄 Files: 25
  📂 Subfolders: 1
  📁 Folder: 1ABC123... (Depth: 1)
    📄 Files: 8
    📂 Subfolders: 1
      📁 Folder: 1DEF456... (Depth: 2)
        📄 Files: 15

💾 Results saved to: /path/to/scan_results.json
✅ Scan completed successfully!
```

## API Structure

The script returns a structured object with the following format:

```javascript
{
  "parentFolderId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "scanTime": 1250,
  "totalFoldersScanned": 3,
  "cacheSize": 3,
  "results": {
    "folderId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "depth": 0,
    "items": [
      {
        "id": "file_id",
        "name": "file_name",
        "mimeType": "application/pdf",
        "size": "1024",
        "modifiedTime": "2024-01-01T00:00:00.000Z",
        "parents": ["parent_folder_id"]
      }
    ],
    "subfolders": [
      // Recursive structure for subfolders
    ]
  }
}
```

## Error Handling

The script includes comprehensive error handling for:

- Missing `service.json` file
- Invalid service account credentials
- Network connectivity issues
- API rate limits
- Permission errors
- Invalid folder IDs

## Performance Features

- **Caching**: Results are cached to avoid redundant API calls
- **Batch Processing**: Processes multiple items efficiently
- **Progress Tracking**: Real-time progress updates
- **Memory Management**: Efficient memory usage for large folder structures

## Troubleshooting

### Common Issues

1. **"service.json file not found"**
   - Make sure `service.json` is in the root directory
   - Check the file name is exactly `service.json`

2. **"Please set the GOOGLE_DRIVE_FOLDER_ID environment variable"**
   - Make sure you have a `.env` file with `GOOGLE_DRIVE_FOLDER_ID` set
   - Or export the environment variable before running the script

3. **"Permission denied"**
   - Share the folder with your service account email
   - Check that the service account has Drive API access

4. **"Invalid folder ID"**
   - Verify the folder ID is correct in your `.env` file
   - Make sure the folder exists and is accessible

5. **Rate limit errors**
   - The script includes automatic retry logic
   - For very large folders, consider running during off-peak hours

## License

This project is open source and available under the MIT License.
