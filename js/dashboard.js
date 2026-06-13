/**
 * Dashboard & Expiration Module
 * Expirations only show lots with CantidadRestante > 0 (unsold stock)
 */
const dashboard = (function() {
    let salesChart;
    let topProductsChart;

    async function init() {
        const salesData = await api.getRecords('Ventas');
        const productsData = await api.getRecords('Productos');
        if (!salesData || !productsData) return;
        updateSummaryMetrics(salesData);
        renderSalesChart(salesData);
        renderTopProductsChart(salesData, productsData);
    }

    function updateSummaryMetrics(sales) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const monthStr = todayStr.substring(0, 7);
        let dayTotal = 0, monthTotal = 0;

        sales.forEach(s => {
            const d = ui.parseAppSheetDate(s.Fecha);
            if (!d) return;
            const saleDate = d.toISOString().split('T')[0];
            const amount = parseFloat(s.Total) || 0;
            if (saleDate === todayStr) dayTotal += amount;
            if (saleDate.startsWith(monthStr)) monthTotal += amount;
        });

        document.getElementById('dash-sales-day').textContent = `$${dayTotal.toFixed(2)}`;
        document.getElementById('dash-sales-month').textContent = `$${monthTotal.toFixed(2)}`;
        document.getElementById('dash-total-trans').textContent = sales.length;
    }

    function renderSalesChart(sales) {
        const ctx = document.getElementById('salesChart').getContext('2d');
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const totalsByDay = last7Days.map(date =>
            sales.filter(s => {
                const d = ui.parseAppSheetDate(s.Fecha);
                return d && d.toISOString().startsWith(date);
            })
            .reduce((sum, s) => sum + (parseFloat(s.Total) || 0), 0)
        );

        if (salesChart) salesChart.destroy();
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(d => d.substring(5)),
                datasets: [{
                    label: 'Ventas ($)',
                    data: totalsByDay,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderTopProductsChart(sales, products) {
        const ctx = document.getElementById('topProductsChart').getContext('2d');
        const salesCount = {};
        sales.forEach(s => {
            salesCount[s.ProductoID] = (salesCount[s.ProductoID] || 0) + (parseInt(s.Cantidad) || 1);
        });

        const sorted = Object.entries(salesCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(([id]) => {
            const p = products.find(prod => prod.ID === id);
            return p ? p.Nombre : 'Desconocido';
        });

        if (topProductsChart) topProductsChart.destroy();
        topProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: sorted.map(s => s[1]),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
        });
    }

    /**
     * Expiration Monitor — only shows lots with stock remaining (CantidadRestante > 0)
     */
    async function loadExpirations() {
        const purchases = await api.getRecords('Compras');
        const products = await api.getRecords('Productos');
        if (!purchases || !products) return;

        const tableBody = document.getElementById('expirations-table-body');
        tableBody.innerHTML = '';

        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        // Only lots that still have stock (CantidadRestante > 0)
        const activeLots = purchases.filter(p => parseInt(p.CantidadRestante) > 0);

        activeLots.forEach(p => {
            if (!p.FechaVencimiento) return;

            const expiryDate = ui.parseAppSheetDate(p.FechaVencimiento);
            if (!expiryDate) return;
            const product = products.find(prod => prod.ID === p.ProductoID);

            let status = '', rowClass = '';

            if (expiryDate < now) {
                status = 'VENCIDO';
                rowClass = 'bg-expired';
            } else if (expiryDate <= thirtyDaysFromNow) {
                status = 'PRÓXIMO A VENCER';
                rowClass = 'bg-warning-expiry';
            } else {
                return;
            }

            const tr = document.createElement('tr');
            tr.className = rowClass;
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${product ? product.Nombre : '---'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${product ? (product.CodigoBarras || '---') : '---'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${p.FechaVencimiento} <span class="text-xs text-gray-500">(${p.CantidadRestante} uds)</span></td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 py-1 rounded-full text-xs font-bold">${status}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button class="text-blue-600 hover:text-blue-900"><i class="fas fa-eye"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        if (tableBody.innerHTML === '') {
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No hay alertas de vencimiento</td></tr>';
        }
    }

    return { init, loadExpirations };
})();
