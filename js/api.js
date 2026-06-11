/**
 * AppSheet API Wrapper
 * Handles communication with Google AppSheet REST API
 */
const api = (function() {
    // [TU_APPSHEET_APP_ID] y [TU_API_KEY]
    const CONFIG = {
        appId: '1b7152c3-48bf-47ca-91c5-4cf89da65310',
        accessKey: 'V2-e3QP3-F2j6I-Jpc4t-Ym046-OSSkT-utwTj-S3LyZ-NmFia',
        region: 'www' // or 'eu', 'asia-southeast'
    };

    const getBaseUrl = (tableName) => 
        `https://${CONFIG.region}.appsheet.com/api/v2/apps/${CONFIG.appId}/tables/${encodeURIComponent(tableName)}/Action`;

    /**
     * General function to call AppSheet API
     * @param {string} tableName - The name of the table in AppSheet
     * @param {string} action - 'Find', 'Add', 'Delete', 'Edit'
     * @param {Object} properties - Optional properties (Locale, Timezone, etc.)
     * @param {Array} rows - Rows data for the action
     */
    async function request(tableName, action, rows = [], properties = {}) {
        if (CONFIG.appId === '[TU_APPSHEET_APP_ID]' || CONFIG.accessKey === '[TU_API_KEY]') {
            console.error('Error: AppSheet App ID o API Key no configurados.');
            ui.showToast('Error: Configura tus credenciales de AppSheet en api.js', 'error');
            return null;
        }

        const url = getBaseUrl(tableName);
        
        const payload = {
            Action: action,
            Properties: {
                Locale: 'es-ES',
                ...properties
            },
            Rows: rows
        };

        try {
            ui.showLoading(true);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'ApplicationAccessKey': CONFIG.accessKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.Message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`AppSheet API Error (${action} on ${tableName}):`, error);
            ui.showToast(`Error de API: ${error.message}`, 'error');
            return null;
        } finally {
            ui.showLoading(false);
        }
    }

    return {
        // Find records
        getRecords: (tableName, selectors = []) => request(tableName, 'Find', selectors),
        
        // Add one or more records
        addRecords: (tableName, rows) => request(tableName, 'Add', rows),
        
        // Edit one or more records
        editRecords: (tableName, rows) => request(tableName, 'Edit', rows),
        
        // Delete one or more records
        deleteRecords: (tableName, rows) => request(tableName, 'Delete', rows)
    };
})();
