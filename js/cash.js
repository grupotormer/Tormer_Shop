/**
 * Cash Reconciliation Module (Cuadratura de Caja)
 */
const cash = (function() {
    let dailySales = [];
    let products = [];
    const TAX_RATE = 0.13;

    async function init() {
        ui.showLoading(true);
        try {
            const [salesData, productsData] = await Promise.all([
                api.getRecords('Ventas'),
                api.getRecords('Productos')
            ]);

            products = Array.isArray(productsData) ? productsData : (productsData.Rows || []);
            filterDailySales(salesData);
            renderDailySales();
            calculateTotals();
        } catch (error) {
            console.error('Error initializing cash module:', error);
            ui.showToast('Error al cargar datos de caja', 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    function filterDailySales(salesData) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const allSales = Array.isArray(salesData) ? salesData : (salesData.Rows || []);

        dailySales = allSales.filter(sale => {
            const saleDateObj = ui.parseAppSheetDate(sale.Fecha);
            const saleDateStr = saleDateObj.toISOString().split('T')[0];
            return saleDateStr === todayStr;
        }).sort((a, b) => ui.parseAppSheetDate(b.Fecha) - ui.parseAppSheetDate(a.Fecha));
    }

    function renderDailySales() {
        const tbody = document.getElementById('cash-sales-table-body');
        tbody.innerHTML = '';

        if (dailySales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No hay ventas registradas hoy</td></tr>';
            return;
        }

        dailySales.forEach(sale => {
            const product = products.find(p => p.ID === sale.ProductoID);
            const saleDate = ui.parseAppSheetDate(sale.Fecha);
            const timeStr = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${timeStr}</td>
                <td class="px-4 py-2 text-sm font-medium text-gray-900">${product ? product.Nombre : 'Producto desconocido'}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${sale.Cantidad}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm font-bold text-gray-900">$${parseFloat(sale.Total).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function calculateTotals() {
        const base = parseFloat(document.getElementById('cash-base').value) || 0;
        const actual = parseFloat(document.getElementById('cash-actual').value) || 0;

        const totalSales = dailySales.reduce((sum, sale) => sum + (parseFloat(sale.Total) || 0), 0);
        const expected = base + totalSales;
        const difference = actual - expected;

        // Update UI
        document.getElementById('cash-sales-total').textContent = `$${totalSales.toFixed(2)}`;
        document.getElementById('cash-expected').textContent = `$${expected.toFixed(2)}`;

        const diffEl = document.getElementById('cash-diff');
        const diffMsgEl = document.getElementById('cash-diff-msg');

        diffEl.textContent = `$${difference.toFixed(2)}`;

        if (Math.abs(difference) < 0.01) {
            diffEl.className = 'text-2xl font-black text-green-600';
            diffMsgEl.textContent = 'CAJA CUADRADA';
            diffMsgEl.className = 'text-center text-sm font-bold mt-2 text-green-600';
        } else if (difference > 0) {
            diffEl.className = 'text-2xl font-black text-blue-600';
            diffMsgEl.textContent = 'SOBRANTE EN CAJA';
            diffMsgEl.className = 'text-center text-sm font-bold mt-2 text-blue-600';
        } else {
            diffEl.className = 'text-2xl font-black text-red-600';
            diffMsgEl.textContent = 'FALTANTE EN CAJA';
            diffMsgEl.className = 'text-center text-sm font-bold mt-2 text-red-600';
        }

        // Summary update
        const tax = totalSales - (totalSales / (1 + TAX_RATE));
        const net = totalSales - tax;

        document.getElementById('cash-summary-gross').textContent = `$${totalSales.toFixed(2)}`;
        document.getElementById('cash-summary-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('cash-summary-net').textContent = `$${net.toFixed(2)}`;
    }

    function printClosure() {
        const base = parseFloat(document.getElementById('cash-base').value) || 0;
        const actual = parseFloat(document.getElementById('cash-actual').value) || 0;
        const totalSales = dailySales.reduce((sum, sale) => sum + (parseFloat(sale.Total) || 0), 0);
        const expected = base + totalSales;
        const difference = actual - expected;
        const now = new Date().toLocaleString();

        let printContent = `
            <div style="font-family: monospace; width: 300px; padding: 20px; border: 1px solid #ccc;">
                <h2 style="text-align: center; margin-bottom: 5px;">Tormer Shop</h2>
                <h3 style="text-align: center; margin-top: 0;">CIERRE DE CAJA</h3>
                <p style="text-align: center; font-size: 0.8em;">${now}</p>
                <hr>
                <div style="display: flex; justify-content: space-between;">
                    <span>Base de Caja:</span>
                    <span>$${base.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Ventas de Hoy:</span>
                    <span>$${totalSales.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
                    <span>Total Esperado:</span>
                    <span>$${expected.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px;">
                    <span>Efectivo Real:</span>
                    <span>$${actual.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; color: ${difference >= 0 ? 'black' : 'red'};">
                    <span>Diferencia:</span>
                    <span>$${difference.toFixed(2)}</span>
                </div>
                <hr>
                <p style="text-align: center; font-weight: bold;">
                    ${Math.abs(difference) < 0.01 ? 'CAJA CUADRADA' : (difference > 0 ? 'SOBRANTE' : 'FALTANTE')}
                </p>
                <br>
                <div style="margin-top: 40px; border-top: 1px solid #000; text-align: center; font-size: 0.8em;">
                    Firma Responsable
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Cierre de Caja</title></head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        // Timeout to ensure content is loaded before printing
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        ui.showToast('Cierre de caja generado');
    }

    return {
        init,
        calculateTotals,
        printClosure
    };
})();
