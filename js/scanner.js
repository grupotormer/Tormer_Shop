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
            // Ignore if user is typing in an input/textarea (except the search bars)
            const tag = document.activeElement.tagName;
            const isSearchBar = document.activeElement.id === 'product-search' || document.activeElement.id === 'cons-product-search';
            const isTyping = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !isSearchBar;
            if (isTyping) return;

            const currentTime = Date.now();

            if (currentTime - lastKeyTime > 100) {
                usbBuffer = '';
            }

            if (e.key === 'Enter') {
                if (usbBuffer.length > 2) {
                    // Only trigger if POS or Consumption view is active
                    const posView = document.getElementById('view-pos');
                    const consView = document.getElementById('view-consumption');

                    if (posView && !posView.classList.contains('hidden')) {
                        pos.addToCart(usbBuffer);
                    } else if (consView && !consView.classList.contains('hidden')) {
                        consumption.addToCart(usbBuffer);
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
        const consView = document.getElementById('view-consumption');
        const isCons = consView && !consView.classList.contains('hidden');

        const containerId = isCons ? 'cons-scanner-container' : 'scanner-container';
        const interactiveId = isCons ? 'cons-interactive' : 'interactive';

        const container = document.getElementById(containerId);
        container.classList.remove('hidden');

        html5QrCode = new Html5Qrcode(interactiveId);
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
            document.getElementById('cons-scanner-container').classList.add('hidden');
            isScanning = false;
        }
    }

    function onScanSuccess(decodedText) {
        const consView = document.getElementById('view-consumption');
        const isCons = consView && !consView.classList.contains('hidden');

        if (isCons) {
            consumption.addToCart(decodedText);
        } else {
            pos.addToCart(decodedText);
        }

        if (navigator.vibrate) navigator.vibrate(100);
    }

    initUsbScanner();

    return { start, stop };
})();
