// NetworkVision AR Networking Glasses
// Main JavaScript Application

// Professional profiles database
const profiles = {
    sarah_chen: {
        name: "Dr. Sarah Chen",
        title: "AI Research Director",
        company: "TechFlow Innovations",
        avatar: "SC",
        tags: ["Machine Learning", "Computer Vision", "Deep Learning"],
        interests: "Passionate about ethical AI development and mentoring young engineers. Looking to collaborate on healthcare AI applications.",
        color: "#667eea"
    },
    james_wilson: {
        name: "James Wilson",
        title: "Senior Product Manager",
        company: "StartupHub Ventures",
        avatar: "JW",
        tags: ["Product Strategy", "User Experience", "Growth Hacking"],
        interests: "Experienced in scaling B2B SaaS products. Always interested in discussing market trends and user psychology.",
        color: "#764ba2"
    },
    maria_rodriguez: {
        name: "Maria Rodriguez",
        title: "Cybersecurity Consultant",
        company: "SecureNet Solutions",
        avatar: "MR",
        tags: ["Network Security", "Penetration Testing", "Risk Assessment"],
        interests: "Specializes in helping startups build secure infrastructure. Enjoys sharing knowledge about emerging security threats.",
        color: "#f093fb"
    },
    david_kim: {
        name: "David Kim",
        title: "Venture Capital Partner",
        company: "Innovation Capital",
        avatar: "DK",
        tags: ["Early Stage Investing", "Fintech", "Mobile Apps"],
        interests: "Looking for revolutionary fintech and mobile solutions. Happy to provide funding advice and industry connections.",
        color: "#f5576c"
    },
    lisa_thompson: {
        name: "Lisa Thompson",
        title: "UX Design Lead",
        company: "Creative Digital Agency",
        avatar: "LT",
        tags: ["User Research", "Interaction Design", "Accessibility"],
        interests: "Advocates for inclusive design and accessibility. Always excited to discuss user-centered design methodologies.",
        color: "#4ecdc4"
    },
    prof_anderson: {
        name: "Prof. Michael Anderson",
        title: "Computer Science Professor",
        company: "University Research Lab",
        avatar: "MA",
        tags: ["Human-Computer Interaction", "User Studies", "Academic Research"],
        interests: "Researching the future of human-computer interaction. Always looking for innovative student projects to mentor.",
        color: "#ff6b6b"
    },
    startup_founder: {
        name: "Alex Rivera",
        title: "Tech Startup Founder",
        company: "NextGen Solutions",
        avatar: "AR",
        tags: ["Entrepreneurship", "Product Development", "Team Building"],
        interests: "Building the next generation of productivity tools. Open to discussing startup challenges and student internships.",
        color: "#8b5cf6"
    }
};

// Application state
let stream = null;
let isScanning = false;
let currentProfiles = new Set();
let scanningInterval = null;
let scanCount = 0;
let lastScanTime = Date.now();

// Function to easily add new profiles during testing
function addTestProfile(id, profileData) {
    profiles[id] = {
        ...profileData,
        qrCode: id
    };
    console.log(`Added profile: ${profileData.name} (QR: ${id})`);
}

// Debug functions
function toggleDebug() {
    const panel = document.getElementById("debugPanel");
    const isVisible = panel.style.display !== "none";
    panel.style.display = isVisible ? "none" : "block";
    
    if (!isVisible) {
        updateDebugPanel();
    }
}

function testProfile() {
    // Test with the first profile for demonstration
    const testId = Object.keys(profiles)[0];
    console.log(`Testing profile: ${testId}`);
    handleQRDetection(testId);
    updateDebugPanel(`Manual test: ${testId}`);
    showNotification("Test profile displayed!", "success");
}

function updateDebugPanel(message = null) {
    if (message) {
        document.getElementById("lastQR").textContent = message;
    }
    
    document.getElementById("profilesFound").textContent = currentProfiles.size;
    
    // Update FPS counter
    const now = Date.now();
    const fps = Math.round(1000 / (now - lastScanTime));
    document.getElementById("fpsCounter").textContent = fps;
    lastScanTime = now;
}

// Main application startup
async function startApp() {
    console.log("Starting NetworkVision app...");
    
    const startupScreen = document.getElementById("startupScreen");
    const vrContainer = document.getElementById("vrContainer");

    // Smooth transition animation
    startupScreen.style.opacity = "0";
    
    setTimeout(() => {
        startupScreen.style.display = "none";
        vrContainer.style.display = "flex";
        initializeCamera();
    }, 800);
}

// Camera initialization
async function initializeCamera() {
    console.log("Initializing camera...");
    updateCameraStatus("Requesting...");
    
    try {
        // Request camera with optimal settings for QR scanning
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1920, min: 640, max: 1920 },
                height: { ideal: 1080, min: 480, max: 1080 },
                frameRate: { ideal: 30, min: 15, max: 60 }
            }
        });

        const cameraLeft = document.getElementById("cameraLeft");
        const cameraRight = document.getElementById("cameraRight");

        // Set up video streams
        cameraLeft.srcObject = stream;
        cameraRight.srcObject = stream;

        // Wait for video to be ready before starting QR scanning
        cameraLeft.addEventListener('loadedmetadata', () => {
            console.log(`📹 Camera ready: ${cameraLeft.videoWidth}x${cameraLeft.videoHeight}`);
            updateCameraStatus("Active");
            updateScanStatus("Starting...");
            startQRScanning();
            showNotification("Camera activated successfully!", "success");
        });

        cameraLeft.addEventListener('error', (e) => {
            console.error("Video error:", e);
            updateCameraStatus("Error");
            showError("Video stream error. Please refresh and try again.");
        });

    } catch (error) {
        console.error("Camera access error:", error);
        updateCameraStatus("Denied");
        
        let errorMessage = "Camera access denied. ";
        if (error.name === 'NotAllowedError') {
            errorMessage += "Please allow camera permissions in your browser settings.";
        } else if (error.name === 'NotFoundError') {
            errorMessage += "No camera found on this device.";
        } else {
            errorMessage += "Please check your camera and try again.";
        }
        
        showError(errorMessage);
    }
}

// QR Code scanning system
function startQRScanning() {
    if (scanningInterval) {
        clearInterval(scanningInterval);
    }

    console.log("Starting QR code scanning...");
    updateScanStatus("Active");
    isScanning = true;
    
    // Scan every 200ms (5 FPS) for optimal performance
    scanningInterval = setInterval(() => {
        if (isScanning) {
            scanForQRCodes();
            scanCount++;
        }
    }, 200);
}

function stopQRScanning() {
    if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
    }
    isScanning = false;
    updateScanStatus("Stopped");
    console.log("QR scanning stopped");
}

function scanForQRCodes() {
    const video = document.getElementById("cameraLeft");
    const canvas = document.getElementById("qrCanvas");
    const context = canvas.getContext("2d");

    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        updateDebugPanel("Video not ready");
        return;
    }

    try {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data for QR code detection
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Try multiple QR detection methods for better reliability
        detectQRCode(imageData, canvas);
        
    } catch (error) {
        console.error("Scanning error:", error);
        updateDebugPanel(`Scan error: ${error.message}`);
    }
}

function detectQRCode(imageData, canvas) {
    // Method 1: Try jsQR library (if available)
    if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });

        if (code && code.data) {
            console.log("jsQR detected:", code.data);
            updateDebugPanel(`jsQR: ${code.data}`);
            handleQRDetection(code.data);
            return;
        }
    }

    // Method 2: Try QR-Scanner library (if available)
    if (typeof QrScanner !== 'undefined') {
        QrScanner.scanImage(canvas, { 
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: false
        })
        .then(result => {
            console.log("🎯 QrScanner detected:", result.data);
            updateDebugPanel(`QrScanner: ${result.data}`);
            handleQRDetection(result.data);
        })
        .catch(() => {
            // No QR code found - this is normal, don't log as error
            updateDebugPanel(`Scan ${scanCount}: No QR detected`);
        });
    } else {
        updateDebugPanel(`Scan ${scanCount}: QR library loading...`);
    }
}

// QR Detection handler - Core functionality
function handleQRDetection(qrData) {
    try {
        // Clean and normalize the QR data
        const profileId = qrData
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\/[^\/]+\//, "")
            .replace(/^.*profile=/, "")
            .replace(/[^a-zA-Z0-9_]/g, "");

        console.log("🔍 QR Detected:", qrData, "→ Profile ID:", profileId);
        updateDebugPanel(`Found: ${profileId}`);

        // Check if profile exists and isn't already displayed
        if (profiles[profileId] && !currentProfiles.has(profileId)) {
            console.log("Showing profile for:", profiles[profileId].name);
            
            // Display the profile
            showProfile(profiles[profileId]);
            currentProfiles.add(profileId);

            // Provide strong visual feedback
            showDetectionFeedback();
            
            // Play audio feedback
            playDetectionSound();
            
            // Show success notification
            showNotification(`Found ${profiles[profileId].name}!`, "success");

            // Auto-remove profile after 8 seconds
            setTimeout(() => {
                currentProfiles.delete(profileId);
                console.log(`♻️ Removed ${profileId} from active profiles`);
            }, 8000);

        } else if (!profiles[profileId]) {
            console.log("No profile found for ID:", profileId);
            updateDebugPanel(`Unknown: ${profileId}`);
            showNoProfileMessage(profileId);
        } else {
            console.log("ℹ️ Profile already displayed:", profileId);
            updateDebugPanel(`Already shown: ${profileId}`);
        }

    } catch (error) {
        console.error("Error in handleQRDetection:", error);
        showNotification("Error processing QR code", "error");
    }
}

// Visual feedback for successful QR detection
function showDetectionFeedback() {
    const eyeViews = document.querySelectorAll(".eye-view");
    
    eyeViews.forEach((view, index) => {
        // Add success class for green border effect
        view.classList.add("success");
        
        // Create ripple effect
        const ripple = document.createElement("div");
        ripple.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100px;
            height: 100px;
            border: 3px solid #10b981;
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            animation: ripple 1s ease-out;
            pointer-events: none;
            z-index: 100;
        `;
        
        view.appendChild(ripple);
        
        // Remove effects after animation
        setTimeout(() => {
            view.classList.remove("success");
            ripple.remove();
        }, 1000);
    });
}

// Audio feedback for QR detection
function playDetectionSound() {
    try {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        
    } catch (error) {
        console.log("🔇 Audio feedback not available");
    }
}

// Display profile card in AR overlay
function showProfile(profile) {
    const overlayLeft = document.getElementById("overlayLeft");
    const overlayRight = document.getElementById("overlayRight");

    const profileCard = createProfileCard(profile);

    // Smart positioning for mobile and desktop
    const position = getOptimalPosition();
    Object.assign(profileCard.style, position);

    // Add to both eye overlays
    const leftCard = profileCard.cloneNode(true);
    const rightCard = profileCard.cloneNode(true);
    
    overlayLeft.appendChild(leftCard);
    overlayRight.appendChild(rightCard);

    // Auto-remove after 8 seconds with fade animation
    setTimeout(() => {
        [leftCard, rightCard].forEach(card => {
            if (card && card.parentNode) {
                card.style.transition = "all 0.5s ease-out";
                card.style.opacity = "0";
                card.style.transform = "scale(0.8) translateY(-20px)";
                
                setTimeout(() => {
                    if (card.parentNode) {
                        card.parentNode.removeChild(card);
                    }
                }, 500);
            }
        });
    }, 8000);

    // Haptic feedback if supported
    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
}

// Smart positioning system for different screen sizes
function getOptimalPosition() {
    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 375;
    
    if (isSmallMobile) {
        // Very small screens - center positioning
        return {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)"
        };
    } else if (isMobile) {
        // Mobile screens - avoid center area, use edges
        const mobilePositions = [
            { top: "10%", left: "5%" },
            { top: "10%", right: "5%" },
            { bottom: "15%", left: "5%" },
            { bottom: "15%", right: "5%" },
            { top: "30%", left: "2%" },
            { top: "30%", right: "2%" }
        ];
        return mobilePositions[Math.floor(Math.random() * mobilePositions.length)];
    } else {
        // Desktop/tablet - more positioning options
        const desktopPositions = [
            { top: "15%", right: "10%" },
            { top: "20%", left: "10%" },
            { bottom: "25%", right: "15%" },
            { bottom: "30%", left: "15%" },
            { top: "40%", right: "5%" },
            { top: "50%", left: "5%" },
            { top: "25%", right: "25%" },
            { bottom: "20%", left: "25%" }
        ];
        return desktopPositions[Math.floor(Math.random() * desktopPositions.length)];
    }
}

// Create profile card HTML element
function createProfileCard(profile) {
    const card = document.createElement("div");
    card.className = "profile-card";
    card.dataset.profile = profile.name;

    card.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar" style="background: linear-gradient(135deg, ${profile.color}, ${adjustColor(profile.color, -20)})">
                ${profile.avatar}
            </div>
            <div class="profile-info">
                <div class="profile-name">${profile.name}</div>
                <div class="profile-title">${profile.title}</div>
                <div class="profile-company">${profile.company}</div>
            </div>
        </div>
        <div class="profile-tags">
            ${profile.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <div class="profile-interests">
            <div class="interests-label">Connect about:</div>
            ${profile.interests}
        </div>
    `;

    return card;
}

// Utility function to adjust color brightness
function adjustColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    
    return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// Error handling and user messages
function showError(message) {
    console.error("Error:", message);
    
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.innerHTML = `
        <h3>Camera Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="
            margin-top: 15px; 
            padding: 10px 20px; 
            background: #ef4444; 
            border: none; 
            border-radius: 8px; 
            color: white; 
            cursor: pointer;
            font-weight: 600;
        ">Retry</button>
    `;
    
    document.body.appendChild(errorDiv);
    showNotification(message, "error");
}

function showNoProfileMessage(profileId) {
    const message = `Profile not found: ${profileId}`;
    console.log("Error", message);
    
    showNotification(message, "error");
    
    // Also show temporary overlay message
    const messageDiv = document.createElement("div");
    messageDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        z-index: 1000;
        font-size: 1rem;
        font-weight: 600;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => messageDiv.remove(), 3000);
}

function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        max-width: 300px;
        backdrop-filter: blur(20px);
        animation: slideInRight 0.3s ease-out;
        ${type === 'success' ? 'background: rgba(16, 185, 129, 0.9);' : ''}
        ${type === 'error' ? 'background: rgba(239, 68, 68, 0.9);' : ''}
        ${type === 'info' ? 'background: rgba(59, 130, 246, 0.9);' : ''}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = "slideOutRight 0.3s ease-in";
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Status update functions
function updateCameraStatus(status) {
    const element = document.getElementById("cameraStatus");
    if (element) {
        element.textContent = status;
        element.style.color = status === "Active" ? "#10b981" : 
                             status === "Error" || status === "Denied" ? "#ef4444" : "#f59e0b";
    }
}

function updateScanStatus(status) {
    const element = document.getElementById("scanStatus");
    if (element) {
        element.textContent = status;
        element.style.color = status === "Active" ? "#10b981" : "#f59e0b";
    }
}

// Device orientation and lifecycle management
window.addEventListener("orientationchange", () => {
    console.log("Orientation changed, reloading...");
    setTimeout(() => location.reload(), 500);
});

// Prevent device sleep during usage
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ("wakeLock" in navigator) {
            wakeLock = await navigator.wakeLock.request("screen");
            console.log("Screen wake lock acquired");
        }
    } catch (err) {
        console.log("Wake lock not available:", err);
    }
}

// Clean up resources when page is hidden/closed
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopQRScanning();
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    } else {
        if (stream && !isScanning) {
            startQRScanning();
        }
    }
});

// Add ripple animation CSS
const rippleStyle = document.createElement("style");
rippleStyle.textContent = `
    @keyframes ripple {
        0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) scale(4);
            opacity: 0;
        }
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

// Initialize wake lock and start the app
requestWakeLock();

// Demo mode for testing (uncomment to enable)
/*
function startDemoMode() {
    const profileIds = Object.keys(profiles);
    let demoIndex = 0;
    
    console.log("🎭 Starting demo mode...");
    setInterval(() => {
        if (demoIndex < profileIds.length) {
            handleQRDetection(profileIds[demoIndex]);
            demoIndex++;
        } else {
            demoIndex = 0;
        }
    }, 4000);
}

// Uncomment to start demo mode after 3 seconds
// setTimeout(startDemoMode, 3000);
*/

console.log("NetworkVision app loaded successfully!");
console.log("Available profiles:", Object.keys(profiles).join(", "));
console.log("Ready to start networking!");