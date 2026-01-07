// server.js - Safe Mode with Deep Logging
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

// Helper: Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/download', async (req, res) => {
    const { url } = req.body;
    console.log(`\n--- New Request: ${url} ---`);
    
    res.json({ status: 'Processing started...' });

    try {
        console.log("Step 1: Fetching playlist metadata...");
        
        // --- SAFE MODE OPTIONS ---
        // We removed 'yesPlaylist: true' to prevent crashes on mixed URLs
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            flatPlaylist: true, 
            noWarnings: true,
            ignoreErrors: true // Prevents crashing on 1 private video
        });

        // Handle both Playlists (entries) and Single Videos (no entries)
        const videos = output.entries || [output];
        const validVideos = videos.filter(v => v !== null);

        console.log(`Found ${validVideos.length} videos. Starting Smart Queue...`);

        notifier.notify({
            title: 'IDM Connector',
            message: `Processing ${validVideos.length} videos...`,
            icon: ICON_PATH,
            appID: 'IDM Playlist Automator',
            sound: false
        });

        // --- STEP 2: SMART SERIAL LOOP ---
        let successCount = 0;

        for (const [index, video] of validVideos.entries()) {
            try {
                // A. Construct URL
                let targetUrl = video.url;
                if (!targetUrl && video.id) {
                    targetUrl = `https://www.youtube.com/watch?v=${video.id}`;
                }

                // B. Get Direct Link
                const directUrlInfo = await youtubedl(targetUrl, {
                    getUrl: true,
                    format: 'best'
                });
                
                const cleanUrl = directUrlInfo.toString().trim();
                const filename = `Video_${index+1}.mp4`;

                // C. Send to IDM
                execFile(IDM_PATH, ['/d', cleanUrl, '/p', DOWNLOAD_PATH, '/f', filename, '/a', '/n']);
                
                console.log(`[${index+1}/${validVideos.length}] Added: ${filename}`);
                successCount++;

                // --- D. TIMING BUFFER ---
                if (index === 0) {
                    console.log("... Waiting 3s for IDM to initialize ...");
                    await sleep(3000); 
                } else {
                    await sleep(500); 
                }

            } catch (err) {
                console.error(`[X] Failed Video #${index+1}: ${err.message ? err.message.split('\n')[0] : "Unknown error"}`);
            }
        }

        // --- STEP 3: START QUEUE ---
        console.log("\nBatch Complete. Starting Queue...");
        await sleep(2000);

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
        // --- DEEP ERROR LOGGING ---
        console.error("\n!!! CRITICAL ERROR !!!");
        console.error("Message:", error.message);
        // If the tool output an error log, print it so we can read it
        if (error.stderr) {
            console.error("STDERR (Tool Output):", error.stderr);
        }
        
        notifier.notify({ title: 'Error', message: 'Failed to process playlist. Check terminal.' });
    }
});

app.listen(3000, () => console.log('IDM Bridge Server running on port 3000'));