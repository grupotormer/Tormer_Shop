/**
 * UI Manager
 * Handles view switching, notifications, and loading states
 */
const ui = (function() {
    
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
        setTimeout(() => {
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
     * Formats a date for AppSheet API (DD/MM/YYYY HH:mm:ss)
     * @param {Date} date
     */
    function formatDateForAPI(date) {
        if (!date) return '';
        const d = new Date(date);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    /**
     * Parses AppSheet date string (MM/DD/YYYY HH:mm:ss) to Date object.
     * Note: AppSheet API consistently returns MM/DD/YYYY in 'Find' actions
     * regardless of the locale sent in the 'Add' action.
     * @param {string} dateStr
     */
    function parseAppSheetDate(dateStr) {
        if (!dateStr) return null;
        if (dateStr.includes('/')) {
            const [datePart, timePart] = dateStr.split(' ');
            const [m, d, y] = datePart.split('/');
            const [hh, mm, ss] = (timePart || '00:00:00').split(':');
            return new Date(y, m - 1, d, hh, mm, ss);
        }
        return new Date(dateStr);
    }

    return {
        init,
        switchView,
        showToast,
        showLoading,
        formatDateForAPI,
        parseAppSheetDate
    };
})();
