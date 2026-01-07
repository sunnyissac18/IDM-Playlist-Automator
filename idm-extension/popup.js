const btn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const statusBox = document.getElementById('statusBox');
const statusIcon = document.getElementById('statusIcon');
const spinner = document.getElementById('loadingSpinner');
const btnText = btn.querySelector('span');

// --- SVG ICONS (Professional Vector Graphics) ---
const ICON_BOLT = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
const ICON_CHECK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_ERROR = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

// Initialize with Bolt Icon
statusIcon.innerHTML = ICON_BOLT;

btn.addEventListener('click', () => {
    setLoadingState(true);

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const currentUrl = tabs[0].url;

        if (!currentUrl.includes('youtube.com')) {
            showError("Not a YouTube page");
            setLoadingState(false);
            return;
        }

        fetch('http://localhost:3000/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl })
        })
        .then(response => response.json())
        .then(data => {
            showSuccess();
        })
        .catch(error => {
            showError("Server Offline");
            console.error(error);
        })
        .finally(() => {
            setTimeout(() => {
                setLoadingState(false);
                if(statusText.innerText === "Sent to Queue!") {
                   resetUI();
                }
            }, 3000);
        });
    });
});

function setLoadingState(isLoading) {
    if (isLoading) {
        btn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'block';
        statusText.innerText = "Processing...";
        statusBox.style.borderColor = "#6366f1"; 
    } else {
        btn.disabled = false;
        btnText.style.display = 'block';
        spinner.style.display = 'none';
    }
}

function showSuccess() {
    statusText.innerText = "Sent to Queue!";
    statusIcon.innerHTML = ICON_CHECK; // Switch to Checkmark
    statusText.style.color = "#4ade80"; 
    statusBox.style.background = "rgba(34, 197, 94, 0.1)"; 
}

function showError(msg) {
    statusText.innerText = msg;
    statusIcon.innerHTML = ICON_ERROR; // Switch to X
    statusText.style.color = "#f87171"; 
    statusBox.style.background = "rgba(248, 113, 113, 0.1)"; 
}

function resetUI() {
    statusText.innerText = "Ready to connect";
    statusIcon.innerHTML = ICON_BOLT;
    statusText.style.color = "#cbd5e1"; 
    statusBox.style.background = "rgba(255, 255, 255, 0.05)";
    statusBox.style.borderColor = "rgba(255, 255, 255, 0.1)";
}