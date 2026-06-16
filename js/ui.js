/**
 * UI Manager
 * Handles view switching, notifications, and loading states
 */
const ui = (function() {
    let toastTimeout;

    function init() {
        // Show initial view
        switchView('pos');
    }

    /**
     * Switches between different sections of the app
     * @param {string} viewId - The ID of the view to show (pos, inventory, dashboard, expirations)
     */
    function switchView(viewId) {
        // Hide all sections
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show target section
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) {
            targetView.classList.remove('hidden');
        }

        // Hide mobile menu if open
        document.getElementById('mobile-menu').classList.add('hidden');

        // Trigger module specific logic
        switch(viewId) {
            case 'pos':
                pos.loadProducts();
                break;
            case 'consumption':
                consumption.loadProducts();
                break;
            case 'discharges':
                discharges.loadProducts();
                break;
            case 'inventory':
                inventory.init();
                break;
            case 'dashboard':
                dashboard.init();
                break;
            case 'expirations':
                dashboard.loadExpirations();
                break;
        }
    }

    /**
     * Shows a temporary notification toast
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', 'info'
     */
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const content = document.getElementById('toast-content');
        const icon = document.getElementById('toast-icon');
        const msg = document.getElementById('toast-message');

        if (toastTimeout) clearTimeout(toastTimeout);

        // Set colors based on type
        content.className = 'px-6 py-3 rounded-lg shadow-2xl text-white font-bold flex items-center ';
        if (type === 'success') {
            content.classList.add('bg-green-600');
            icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        } else if (type === 'error') {
            content.classList.add('bg-red-600');
            icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        } else {
            content.classList.add('bg-blue-600');
            icon.innerHTML = '<i class="fas fa-info-circle"></i>';
        }

        msg.textContent = message;
        
        // Show toast
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('toast-show'), 10);

        // Hide after 3 seconds
        toastTimeout = setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    }

    /**
     * Shows/hides loading overlay
     * @param {boolean} show 
     */
    function showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Parses date strings from AppSheet.
     * AppSheet Find action returns MM/DD/YYYY HH:mm:ss.
     * Outbound format is DD/MM/YYYY HH:mm:ss.
     * This function robustly handles both to prevent Invalid Date errors.
     */
    function parseAppSheetDate(dateStr) {
        if (!dateStr) return new Date();
        // Handle ISO format if present
        if (dateStr.includes('T')) return new Date(dateStr);

        const [datePart, timePart] = dateStr.split(' ');
        const parts = datePart.split('/');
        if (parts.length !== 3) return new Date(dateStr);

        let m, d, y;
        const p0 = parseInt(parts[0]);
        const p1 = parseInt(parts[1]);
        const p2 = parseInt(parts[2]);

        // Heuristic to distinguish DD/MM vs MM/DD
        if (p0 > 12) {
            // First part > 12: Must be Day (DD/MM/YYYY)
            d = p0; m = p1; y = p2;
        } else if (p1 > 12) {
            // Second part > 12: Must be Day (MM/DD/YYYY)
            m = p0; d = p1; y = p2;
        } else {
            // Ambiguous: Default to AppSheet's inbound format (MM/DD/YYYY)
            m = p0; d = p1; y = p2;
        }

        return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${timePart || '00:00:00'}`);
    }

    /**
     * Formats Date object for AppSheet API (DD/MM/YYYY HH:mm:ss)
     */
    function formatDateForAPI(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${d}/${m}/${y} ${h}:${min}:${s}`;
    }

    return {
        init,
        switchView,
        showToast,
        showLoading,
        parseAppSheetDate,
        formatDateForAPI
    };
})();
