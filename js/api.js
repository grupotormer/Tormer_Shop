/**
 * AppSheet API Wrapper
 * Handles communication with Google AppSheet REST API
 */
const api = (function() {
    const CONFIG = {
        appId: '1b7152c3-48bf-47ca-91c5-4cf89da65310',
        accessKey: 'V2-e3QP3-F2j6I-Jpc4t-Ym046-OSSkT-utwTj-S3LyZ-NmFia',
        region: 'www'
    };

    const getBaseUrl = (tableName) =>
        `https://${CONFIG.region}.appsheet.com/api/v2/apps/${CONFIG.appId}/tables/${encodeURIComponent(tableName)}/Action`;

    /**
     * Visible on-screen debug log (useful on iPad where console isn't accessible)
     */
    function debugLog(message, isError = false) {
        // Log to console instead of screen
        if (isError) {
            console.error(`[API DEBUG] ${message}`);
        } else {
            console.log(`[API DEBUG] ${message}`);
        }
    }

    async function request(tableName, action, rows = [], properties = {}) {
        const url = getBaseUrl(tableName);
        const payload = {
            Action: action,
            Properties: { Locale: 'es-ES', ...properties },
            Rows: rows
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            ui.showLoading(true);
            debugLog(`→ ${action} ${tableName}: ${JSON.stringify(rows)}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'ApplicationAccessKey': CONFIG.accessKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                let message = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    message = errorData.Message || JSON.stringify(errorData);
                } catch (_) {
                    try { message = await response.text(); } catch (__) {}
                }
                throw new Error(message);
            }

            const text = await response.text();
            const data = text ? JSON.parse(text) : [];
            debugLog(`✓ ${action} ${tableName} OK: ${JSON.stringify(data).substring(0, 300)}`);
            return data.Rows || data;

        } catch (error) {
            if (error.name === 'AbortError') {
                debugLog(`✗ TIMEOUT ${action} ${tableName} (20s sin respuesta)`, true);
                ui.showToast(`Tiempo agotado: ${action} en ${tableName}`, 'error');
            } else {
                debugLog(`✗ ERROR ${action} ${tableName}: ${error.message}`, true);
                ui.showToast(`Error de API (${action} ${tableName}): ${error.message}`, 'error');
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
            ui.showLoading(false);
        }
    }

    return {
        getRecords: (tableName, selectors = []) => request(tableName, 'Find', selectors),
        addRecords: (tableName, rows) => request(tableName, 'Add', rows),
        editRecords: (tableName, rows) => request(tableName, 'Edit', rows),
        deleteRecords: (tableName, rows) => request(tableName, 'Delete', rows)
    };
})();
