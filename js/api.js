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

    async function request(tableName, action, rows = [], properties = {}) {
        const url = getBaseUrl(tableName);
        const payload = {
            Action: action,
            Properties: { Locale: 'es-ES', ...properties },
            Rows: rows
        };
        try {
            ui.showLoading(true);
            console.log(`API Request: ${action} on ${tableName}`, payload);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'ApplicationAccessKey': CONFIG.accessKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    const text = await response.text();
                    console.error(`API Error Response Text (${action} on ${tableName}):`, text);
                    throw new Error(`HTTP error! status: ${response.status} - ${text}`);
                }
                console.error(`API Error Response (${action} on ${tableName}):`, errorData);
                throw new Error(errorData.Message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log(`API Response (${action} on ${tableName}):`, result);
            return result;
        } catch (error) {
            console.error(`AppSheet API Error (${action} on ${tableName}):`, error);
            ui.showToast(`Error de API: ${error.message}`, 'error');
            return null;
        } finally {
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