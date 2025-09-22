# Google Drive & Sheets Automation Scripts

## Overview
This project contains Node.js scripts designed to automate Google Drive folder sharing with participants based on data from Google Sheets. It's specifically built for managing participant data for events, certificates, or other materials.

## Core Functionality
- **Scan Google Drive**: Recursively scan parent folders and catalog subfolders
- **Cache Participant Data**: Fetch participant information from Google Sheets
- **Share Folders**: Match participants to folders and share via email
- **Update Status**: Mark sharing completion in Google Sheets

## Project Structure

### Core Files
- `cache.js` - Scans Google Drive folders and creates folder mapping
- `cache_peserta.js` - Fetches participant data from Google Sheets
- `share_peserta_folder.js` - Main orchestration script for sharing folders
- `service.json` - Google Cloud service account credentials
- `package.json` - Node.js dependencies and scripts

### Generated Files
- `scan_results.json` - Maps folder names to Google Drive folder IDs
- `cache_peserta.json` - Cached participant data from Google Sheets
- `share_peserta_folder.json` - Log of sharing operations and results

### Configuration Files
- `README.md` - Setup and usage instructions
- `AGENTS.md` - CLI agent interaction guidelines

## Dependencies
- `googleapis` - Official Google API client library
- `dotenv` - Environment variable management

## Available Scripts
- `npm start` - Run cache.js (scan Google Drive)
- `npm run cache-peserta` - Run cache_peserta.js (fetch participants)
- `npm run share-folders` - Run share_peserta_folder.js (share folders)
- `npm run full-process` - Run all scripts in sequence

## Workflow
1. **Scan Phase**: `cache.js` scans Google Drive and creates folder mapping
2. **Cache Phase**: `cache_peserta.js` fetches participant data from sheets
3. **Share Phase**: `share_peserta_folder.js` matches and shares folders with participants
4. **Update Phase**: Google Sheets updated with sharing status and timestamps

## Web Interface Fixes

### Fix: Inconsistent Results Tab Display

-   **Problem**: The "Results" tab showed data in two different formats. When results were streamed via WebSocket, they had one structure. When results were loaded by fetching from the `/api/logs/share` endpoint, the structure was different. This led to inconsistent and sometimes broken display of information.
-   **Solution**: A client-side conversion function, `convertApiToWebSocketFormat`, was added to `public/index.html`. This function intercepts the data from the API call and reformats it to match the structure used by the WebSocket events.
-   **Outcome**: The "Results" tab now consistently displays the same information format, regardless of whether the data is loaded on-demand via the API or updated in real-time through the WebSocket connection. This ensures a seamless and reliable user experience.

## Security Notes
- `service.json` contains sensitive credentials and should be kept private
- Uses Google Cloud service account for API authentication
- Environment variables stored in `.env` file for configuration