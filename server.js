// server.js - Final "Wake Up" Version
const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const youtubedl = require('youtube-dl-exec');
const notifier = require('node-notifier');
const os = require('os');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const IDM_PATH = 'C:\\Program Files (x86)\\Internet Download Manager\\idman.exe';
const DOWNLOAD_PATH = path.join(os.homedir(), 'Videos');
const ICON_PATH = path.join(__dirname, 'idm_icon.png');

// Helper function to pause execution (Sleep)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/download', async (req, res) => {
    const { url } = req.body;
    console.log(`\n--- New Request: ${url} ---`);
    
    res.json({ status: 'Processing started...' });

    try {
        // --- STEP 0: WAKE UP IDM (THE FIX) ---
        console.log("Step 0: Waking up IDM...");
        execFile(IDM_PATH); // Launch IDM interface
        // Wait 3 seconds for IDM to fully load so it doesn't miss Video #1
        await sleep(500); 

        console.log("Step 1: Fetching playlist metadata...");
        
        // Fetch playlist info
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            flatPlaylist: true,
            yesPlaylist: true, // Force playlist mode
            noWarnings: true
        });

        const videos = output.entries || [output];
        const validVideos = videos.filter(v => v !== null);

        console.log(`Found ${validVideos.length} videos. Processing...`);

        notifier.notify({
            title: 'IDM Connector',
            message: `Found ${validVideos.length} videos. Adding to IDM...`,
            icon: ICON_PATH,
            appID: 'IDM Playlist Automator',
            sound: false
        });

        // --- STEP 2: PACED SERIAL LOOP ---
        let successCount = 0;

        for (const [index, video] of validVideos.entries()) {
            try {
                // Construct URL
                let targetUrl = video.url;
                if (!targetUrl && video.id) {
                    targetUrl = `https://www.youtube.com/watch?v=${video.id}`;
                }

                // Fetch Direct Link
                const directUrlInfo = await youtubedl(targetUrl, {
                    getUrl: true,
                    format: 'best'
                });
                
                const cleanUrl = directUrlInfo.toString().trim();
                const filename = `Video_${index+1}.mp4`; 

                // Send to IDM
                execFile(IDM_PATH, ['/d', cleanUrl, '/p', DOWNLOAD_PATH, '/f', filename, '/a', '/n']);
                
                console.log(`[${index+1}/${validVideos.length}] Added: ${filename}`);
                successCount++;

                // SMALL PAUSE between videos (0.5s) to prevent IDM from choking
                await sleep(500);

            } catch (err) {
                console.error(`[X] Failed Video #${index+1}: ${err.message.split('\n')[0]}`);
            }
        }

        // --- STEP 3: START QUEUE ---
        console.log("\nBatch Complete. Starting Queue...");
        
        // Wait 2 seconds to make sure the last file is registered
        await sleep(500);

        execFile(IDM_PATH, ['/s']);
        
        notifier.notify({
            title: 'Download Started',
            message: `Successfully added ${successCount}/${validVideos.length} videos.`,
            icon: ICON_PATH,
            appID: 'IDM Playlist Automator',
            sound: true
        });
        console.log("IDM Queue Started.");

    } catch (error) {
        console.error("Critical Error:", error.message);
        notifier.notify({ title: 'Error', message: 'Failed to process playlist.' });
    }
});

app.listen(3000, () => console.log('IDM Bridge Server running on port 3000'));