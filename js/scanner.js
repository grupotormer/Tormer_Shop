/**
 * Barcode Scanner Module
 * USB scanner works globally without needing focus on search input
 */
const scanner = (function() {
    let html5QrCode;
    let isScanning = false;
    let usbBuffer = '';
    let lastKeyTime = Date.now();

    function initUsbScanner() {
        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in an input/textarea (except the search bar)
            const tag = document.activeElement.tagName;
            const isSearchBar = document.activeElement.id === 'product-search';
            const isTyping = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !isSearchBar;
            if (isTyping) return;

            const currentTime = Date.now();

            if (currentTime - lastKeyTime > 100) {
                usbBuffer = '';
            }

            if (e.key === 'Enter') {
                if (usbBuffer.length > 2) {
                    // Only trigger if POS view is active
                    const posView = document.getElementById('view-pos');
                    if (posView && !posView.classList.contains('hidden')) {
                        pos.addToCart(usbBuffer);
                    }
                    usbBuffer = '';
                    e.preventDefault();
                }
            } else if (e.key.length === 1) {
                usbBuffer += e.key;
            }

            lastKeyTime = currentTime;
        });
    }

    async function start() {
        const container = document.getElementById('scanner-container');
        container.classList.remove('hidden');

        html5QrCode = new Html5Qrcode("interactive");
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        try {
            isScanning = true;
            await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
        } catch (err) {
            console.error("Error starting scanner:", err);
            ui.showToast("No se pudo acceder a la cámara", "error");
            container.classList.add('hidden');
        }
    }

    async function stop() {
        if (html5QrCode && isScanning) {
            await html5QrCode.stop();
            document.getElementById('scanner-container').classList.add('hidden');
            isScanning = false;
        }
    }

    function onScanSuccess(decodedText) {
        pos.addToCart(decodedText);
        if (navigator.vibrate) navigator.vibrate(100);
    }

    initUsbScanner();

    return { start, stop };
})();
