// Display profile card in AR overlay - positioned next to QR code
function showProfile(profile) {
    const overlayLeft = document.getElementById("overlayLeft");
    const overlayRight = document.getElementById("overlayRight");

    const profileCard = createProfileCard(profile);

    // Position next to QR code if we have the position
    const position = getQRBasedPosition();
    Object.assign(profileCard.style, position);

    // Add to both eye overlays
    const leftCard = profileCard.cloneNode(true);
    const rightCard = profileCard.cloneNode(true);
    
    overlayLeft.appendChild(leftCard);
    overlayRight.appendChild(rightCard);

    // Auto-remove after 6 seconds (shorter for VR experience)
    setTimeout(() => {
        [leftCard, rightCard].forEach(card => {
            if (card && card.parentNode) {
                card.style.transition = "all 0.4s ease-out";
                card.style.opacity = "0";
                card.style.transform = "scale(0.9) translateY(-10px)";
                
                setTimeout(() => {
                    if (card.parentNode) {
                        card.parentNode.removeChild(card);
                    }
                }, 400);
            }
        });
    }, 6000);

    // Haptic feedback if supported
    if (navigator.vibrate) {
        navigator.vibrate([30, 20, 30]);
    }
}

// Smart positioning based on QR code location
function getQRBasedPosition() {
    if (!lastQRPosition) {
        // Fallback to safe default position
        return {
            top: "20%",
            right: "10%"
        };
    }

    const overlay = document.getElementById("overlayLeft");
    const overlayRect = overlay.getBoundingClientRect();
    
    // Convert QR canvas coordinates to overlay coordinates
    const qrCenterX = (lastQRPosition.x + lastQRPosition.width / 2) / lastQRPosition.canvasWidth;
    const qrCenterY = (lastQRPosition.y + lastQRPosition.height / 2) / lastQRPosition.canvasHeight;
    
    // Determine best position relative to QR code
    let position = {};
    
    // Check if QR is in left half or right half
    if (qrCenterX < 0.5) {
        // QR is on left, put profile on right side
        position.left = `${Math.min(qrCenterX * 100 + 25, 70)}%`;
    } else {
        // QR is on right, put profile on left side
        position.right = `${Math.min((1 - qrCenterX) * 100 + 25, 70)}%`;
    }
    
    // Vertical positioning - avoid extreme top/bottom
    if (qrCenterY < 0.3) {
        // QR is at top, put profile below
        position.top = `${Math.max(qrCenterY * 100 + 15, 25)}%`;
    } else if (qrCenterY > 0.7) {
        // QR is at bottom, put profile above
        position.bottom = `${Math.max((1 - qrCenterY) * 100 + 15, 25)}%`;
    } else {
        // QR is in middle, align vertically
        position.top = `${Math.max(Math.min(qrCenterY * 100 - 10, 60), 20)}%`;
    }
    
    return position;
}

// Enhanced QR scanning with better stability
function startQRScanning() {
    if (scanningInterval) {
        clearInterval(scanningInterval);
    }

    console.log("🔍 Starting QR code scanning...");
    updateScanStatus("Active");
    isScanning = true;
    
    // Slower scan rate for better stability (3 FPS)
    scanningInterval = setInterval(() => {
        if (isScanning && cameraInitialized) {
            try {
                scanForQRCodes();
                scanCount++;
            } catch (error) {
                console.error("❌ Scan error:", error);
                // Don't stop scanning on errors, just log them
            }
        }
    }, 333); // ~3 FPS for stability
}

function stopQRScanning() {
    if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
    }
    isScanning = false;
    updateScanStatus("Stopped");
    console.log("⏹️ QR scanning stopped");
}

// Better resource cleanup
function cleanupResources() {
    console.log("🧹 Cleaning up resources...");
    
    stopQRScanning();
    
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
            console.log(`🔇 Stopped ${track.kind} track`);
        });
        stream = null;
    }
    
    cameraInitialized = false;
    currentProfiles.clear();
    lastQRPosition = null;
}

// Enhanced page visibility handling
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        console.log("📱 Page hidden, pausing scanning");
        stopQRScanning();
    } else {
        console.log("📱 Page visible, resuming scanning");
        if (cameraInitialized && !isScanning) {
            setTimeout(() => {
                startQRScanning();
            }, 1000); // Delay to ensure stable resume
        }
    }
});

// Prevent accidental page unload
window.addEventListener('beforeunload', (e) => {
    if (preventHomeScreen && cameraInitialized) {
        cleanupResources();
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Camera will be stopped.';
        return e.returnValue;
    }
});

// Handle orientation changes more gracefully
window.addEventListener("orientationchange", () => {
    console.log("📱 Orientation changed");
    stopQRScanning();
    
    setTimeout(() => {
        if (cameraInitialized) {
            console.log("📱 Restarting scanning after orientation change");
            startQRScanning();
        }
    }, 1500); // Longer delay for orientation changes
});

// Enhanced error handling for video streams
function setupVideoErrorHandling() {
    const videos = [document.getElementById("cameraLeft"), document.getElementById("cameraRight")];
    
    videos.forEach((video, index) => {
        video.addEventListener('error', (e) => {
            console.error(`❌ Video ${index} error:`, e);
            updateCameraStatus("Error");
            
            // Try to recover after a delay
            setTimeout(() => {
                if (!cameraInitialized) {
                    console.log("🔄 Attempting camera recovery...");
                    initializeCamera();
                }
            }, 3000);
        });
        
        video.addEventListener('stalled', () => {
            console.warn(`⚠️ Video ${index} stalled`);
        });
        
        video.addEventListener('suspend', () => {
            console.warn(`⚠️ Video ${index} suspended`);
        });
    });
}

// Initialize error handling when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupVideoErrorHandling();
});

// Enhanced wake lock with retry logic
async function requestWakeLock() {
    try {
        if ("wakeLock" in navigator) {
            wakeLock = await navigator.wakeLock.request("screen");
            console.log("💡 Screen wake lock acquired");
            
            wakeLock.addEventListener('release', () => {
                console.log("💡 Wake lock released");
                // Try to reacquire after a delay
                setTimeout(requestWakeLock, 2000);
            });
        }
    } catch (err) {
        console.log("💡 Wake lock not available:", err.message);
        // Retry in 5 seconds
        setTimeout(requestWakeLock, 5000);
    }
}// NetworkVision AR Networking Glasses
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
let lastQRPosition = null; // Store last QR code position
let cameraInitialized = false;
let preventHomeScreen = false;

// Function to easily add new profiles during testing
function addTestProfile(id, profileData) {
    profiles[id] = {
        ...profileData,
        qrCode: id
    };
    console.log(`✅ Added profile: ${profileData.name} (QR: ${id})`);
}

// Prevent accidental navigation
function preventNavigation() {
    preventHomeScreen = true;
    
    // Prevent back button
    window.addEventListener('popstate', (e) => {
        if (preventHomeScreen) {
            e.preventDefault();
            window.history.pushState(null, null, window.location.href);
        }
    });
    
    // Prevent refresh and other navigation
    window.addEventListener('beforeunload', (e) => {
        if (preventHomeScreen) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Add initial history state
    window.history.pushState(null, null, window.location.href);
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
    console.log(`🧪 Testing profile: ${testId}`);
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
    console.log("🚀 Starting NetworkVision app...");
    
    // Prevent navigation issues
    preventNavigation();
    
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

// Camera initialization with better error handling
async function initializeCamera() {
    if (cameraInitialized) {
        console.log("📷 Camera already initialized");
        return;
    }
    
    console.log("📷 Initializing camera...");
    updateCameraStatus("Requesting...");
    
    try {
        // More specific camera constraints for better stability
        const constraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280, min: 640, max: 1920 },
                height: { ideal: 720, min: 480, max: 1080 },
                frameRate: { ideal: 24, min: 15, max: 30 } // Lower frame rate for stability
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        const cameraLeft = document.getElementById("cameraLeft");
        const cameraRight = document.getElementById("cameraRight");

        // Set up video streams
        cameraLeft.srcObject = stream;
        cameraRight.srcObject = stream;

        // Better event handling for video
        const videoReadyPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Video timeout")), 10000);
            
            cameraLeft.addEventListener('loadedmetadata', () => {
                clearTimeout(timeout);
                resolve();
            }, { once: true });
            
            cameraLeft.addEventListener('error', (e) => {
                clearTimeout(timeout);
                reject(e);
            }, { once: true });
        });

        await videoReadyPromise;

        console.log(`📹 Camera ready: ${cameraLeft.videoWidth}x${cameraLeft.videoHeight}`);
        updateCameraStatus("Active");
        updateScanStatus("Starting...");
        cameraInitialized = true;
        
        // Start scanning after short delay
        setTimeout(() => {
            startQRScanning();
            showNotification("Camera activated successfully!", "success");
        }, 1000);

    } catch (error) {
        console.error("❌ Camera access error:", error);
        updateCameraStatus("Error");
        cameraInitialized = false;
        
        let errorMessage = "Camera access failed. ";
        if (error.name === 'NotAllowedError') {
            errorMessage += "Please allow camera permissions and refresh.";
        } else if (error.name === 'NotFoundError') {
            errorMessage += "No camera found on this device.";
        } else if (error.message.includes("timeout")) {
            errorMessage += "Camera took too long to start. Please refresh.";
        } else {
            errorMessage += "Please check your camera and refresh.";
        }
        
        showError(errorMessage);
    }
}

// QR Code scanning system
function startQRScanning() {
    if (scanningInterval) {
        clearInterval(scanningInterval);
    }

    console.log("🔍 Starting QR code scanning...");
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
    console.log("⏹️ QR scanning stopped");
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
        console.error("❌ Scanning error:", error);
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
            console.log("🎯 jsQR detected:", code.data);
            updateDebugPanel(`jsQR: ${code.data}`);
            
            // Store QR position for profile placement
            lastQRPosition = {
                x: code.location.topLeftCorner.x,
                y: code.location.topLeftCorner.y,
                width: Math.abs(code.location.topRightCorner.x - code.location.topLeftCorner.x),
                height: Math.abs(code.location.bottomLeftCorner.y - code.location.topLeftCorner.y),
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            };
            
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
            
            // Store approximate position (QrScanner doesn't provide exact coordinates)
            lastQRPosition = {
                x: canvas.width * 0.3, // Approximate center-left
                y: canvas.height * 0.3,
                width: canvas.width * 0.4,
                height: canvas.height * 0.4,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            };
            
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
            console.log("✅ Showing profile for:", profiles[profileId].name);
            
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
            console.log("❌ No profile found for ID:", profileId);
            updateDebugPanel(`Unknown: ${profileId}`);
            showNoProfileMessage(profileId);
        } else {
            console.log("ℹ️ Profile already displayed:", profileId);
            updateDebugPanel(`Already shown: ${profileId}`);
        }

    } catch (error) {
        console.error("❌ Error in handleQRDetection:", error);
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
    console.error("❌ Error:", message);
    
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
    console.log("❌", message);
    
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
    console.log("📱 Orientation changed, reloading...");
    setTimeout(() => location.reload(), 500);
});

// Prevent device sleep during usage
async function requestWakeLock() {
    try {
        if ("wakeLock" in navigator) {
            wakeLock = await navigator.wakeLock.request("screen");
            console.log("💡 Screen wake lock acquired");
        }
    } catch (err) {
        console.log("💡 Wake lock not available:", err);
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

// Enhanced app initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("🎯 NetworkVision DOM loaded");
    setupVideoErrorHandling();
    
    // Preload QR detection libraries
    if (typeof jsQR === 'undefined') {
        console.log("📚 jsQR library not loaded");
    } else {
        console.log("✅ jsQR library ready");
    }
    
    if (typeof QrScanner === 'undefined') {
        console.log("📚 QrScanner library not loaded");
    } else {
        console.log("✅ QrScanner library ready");
    }
});

// Demo mode for testing (uncomment to enable)
/*
function startDemoMode() {
    const profileIds = Object.keys(profiles);
    let demoIndex = 0;
    
    console.log("🎭 Starting demo mode...");
    setInterval(() => {
        if (demoIndex < profileIds.length) {
            // Simulate QR position for demo
            lastQRPosition = {
                x: Math.random() * 200,
                y: Math.random() * 200,
                width: 100,
                height: 100,
                canvasWidth: 640,
                canvasHeight: 480
            };
            handleQRDetection(profileIds[demoIndex]);
            demoIndex++;
        } else {
            demoIndex = 0;
        }
    }, 5000);
}

// Uncomment to start demo mode after 3 seconds
// setTimeout(startDemoMode, 3000);
*/

console.log("🎯 NetworkVision app loaded successfully!");
console.log("📋 Available profiles:", Object.keys(profiles).join(", "));
console.log("🚀 Ready to start networking!");
console.log("📱 VR-optimized for mobile experience");