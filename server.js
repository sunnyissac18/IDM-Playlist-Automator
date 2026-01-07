// server.js - Deployment Ready Version
const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
// We use the 'create' method to specify the exact path to the binary
const youtubedl = require('youtube-dl-exec').create; 
const notifier = require('node-notifier');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const app = express();
app.use(cors());
app.use(express.json());

// --- CRITICAL PATH FIX ---
// This detects if we are running as a compiled .exe (pkg) or as a script (node)
const isPkg = typeof process.pkg !== 'undefined';

// If inside .exe, look in the same folder as the .exe. 
// If in VS Code, look in the current folder.
const BASE_DIR = isPkg ? path.dirname(process.execPath) : __dirname;

// 1. Path to IDM
const IDM_PATH = 'C:\\Program Files (x86)\\Internet Download Manager\\idman.exe';
// 2. Path to Save Videos
const DOWNLOAD_PATH = path.join(os.homedir(), 'Videos');
// 3. Path to Icon (Must be a real file next to the .exe)
const ICON_PATH = path.join(BASE_DIR, 'idm_icon.png');
// 4. Path to Downloader (Must be a real file next to the .exe)
const YTDLP_PATH = path.join(BASE_DIR, 'yt-dlp.exe');

// Initialize the downloader with the specific binary path
const yt = youtubedl(YTDLP_PATH);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/download', async (req, res) => {
    let { url } = req.body;
    console.log(`\n--- New Request: ${url} ---`);
    res.json({ status: 'Processing started...' });

    try {
        // Fix for "Ghost File" crash
        if (!fs.existsSync(YTDLP_PATH)) {
            throw new Error(`MISSING FILE: Could not find yt-dlp.exe at ${YTDLP_PATH}`);
        }

        // URL Sanitizer
        if (url.includes('list=')) {
            const urlObj = new URL(url);
            const listId = urlObj.searchParams.get('list');
            url = `https://www.youtube.com/playlist?list=${listId}`;
        }

        console.log("Step 1: Fetching playlist metadata...");
        
        const output = await yt(url, {
            dumpSingleJson: true,
            flatPlaylist: true, 
            noWarnings: true,
            ignoreErrors: true
        });

        const videos = output.entries || [output];
        const validVideos = videos.filter(v => v !== null);

        console.log(`Found ${validVideos.length} videos. Processing...`);

        notifier.notify({
            title: 'IDM Connector',
            message: `Found ${validVideos.length} videos.`,
            icon: ICON_PATH, // Uses the fixed real path
            appID: 'IDM Playlist Automator',
            sound: false
        });

        // --- LOOP ---
        let successCount = 0;
        for (const [index, video] of validVideos.entries()) {
            try {
                let targetUrl = video.url;
                if (!targetUrl && video.id) targetUrl = `https://www.youtube.com/watch?v=${video.id}`;

                const directUrlInfo = await yt(targetUrl, {
                    getUrl: true,
                    format: 'best'
                });
                
                const cleanUrl = directUrlInfo.toString().trim();
                const filename = `Video_${index+1}.mp4`;

                execFile(IDM_PATH, ['/d', cleanUrl, '/p', DOWNLOAD_PATH, '/f', filename, '/a', '/n']);
                
                console.log(`[${index+1}/${validVideos.length}] Added: ${filename}`);
                successCount++;

                if (index === 0) await sleep(3000);
                else await sleep(500);

            } catch (err) {
                console.error(`[X] Failed Video #${index+1}`);
            }
        }

        console.log("Batch Complete. Starting Queue...");
        await sleep(2000);
        execFile(IDM_PATH, ['/s']);
        
        notifier.notify({
            title: 'Download Started',
            message: `Added ${successCount} videos to IDM.`,
            icon: ICON_PATH,
            appID: 'IDM Playlist Automator',
            sound: true
        });

    } catch (error) {
        console.log("\n!!! CRITICAL ERROR !!!");
        console.error(error.message);
        notifier.notify({ title: 'Critical Error', message: 'Missing yt-dlp.exe or Icon file.' });
    }
});

app.listen(3000, () => console.log('IDM Bridge Server running on port 3000'));