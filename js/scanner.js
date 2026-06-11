/**
 * Barcode Scanner Module
 * Handles camera scanning and USB scanner input
 */
const scanner = (function() {
    let html5QrCode;
    let isScanning = false;
    let usbBuffer = '';
    let lastKeyTime = Date.now();

    /**
     * Initializes global keyboard listener for USB Barcode Scanners
     */
    function initUsbScanner() {
        document.addEventListener('keydown', (e) => {
            const currentTime = Date.now();
            
            // USB scanners usually type very fast. 
            // If the time between keystrokes is very small, it's likely a scanner.
            if (currentTime - lastKeyTime > 50) {
                usbBuffer = ''; // Reset buffer if it's too slow (likely human typing)
            }

            if (e.key === 'Enter') {
                if (usbBuffer.length > 2) {
                    pos.addToCart(usbBuffer);
                    usbBuffer = '';
                }
            } else if (e.key.length === 1) {
                usbBuffer += e.key;
            }

            lastKeyTime = currentTime;
        });
    }

    /**
     * Starts the camera-based scanner
     */
    async function start() {
        const container = document.getElementById('scanner-container');
        container.classList.remove('hidden');

        html5QrCode = new Html5Qrcode("interactive");
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        try {
            isScanning = true;
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                onScanSuccess
            );
        } catch (err) {
            console.error("Error starting scanner:", err);
            ui.showToast("No se pudo acceder a la cámara", "error");
            container.classList.add('hidden');
        }
    }

    /**
     * Stops the camera-based scanner
     */
    async function stop() {
        if (html5QrCode && isScanning) {
            await html5QrCode.stop();
            document.getElementById('scanner-container').classList.add('hidden');
            isScanning = false;
        }
    }

    function onScanSuccess(decodedText) {
        console.log(`Code scanned: ${decodedText}`);
        pos.addToCart(decodedText);
        
        // Vibrate if supported
        if (navigator.vibrate) navigator.vibrate(100);
        
        // Optional: stop after one scan or keep going
        // stop(); 
    }

    // Initialize USB scanner immediately
    initUsbScanner();

    return {
        start,
        stop
    };
})();
