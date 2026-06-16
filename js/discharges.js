/**
 * Discharges Module
 * - Handles inventory discharge for expired, exploded, or unfit products.
 * - Uses FIFO lot management for stock deduction.
 * - Integrated with AppSheet 'DescargosDeInventario' table.
 */
const discharges = (function() {
    let products = [];
    let cart = [];

    async function loadProducts() {
        const productData = await api.getRecords('Productos');
        const purchaseData = await api.getRecords('Compras');

        if (!productData) return;

        // Map product ID to its oldest available lot cost (FIFO cost)
        const costMap = {};
        if (purchaseData) {
            const sortedPurchases = Array.isArray(purchaseData) ? [...purchaseData] : (purchaseData.Rows || []);
            sortedPurchases.sort((a, b) => ui.parseAppSheetDate(a.FechaRegistro) - ui.parseAppSheetDate(b.FechaRegistro));

            const productsArray = Array.isArray(productData) ? productData : (productData.Rows || []);
            const EPSILON = 0.0001;
            productsArray.forEach(p => {
                const pid = String(p.ID).trim();
                const oldestLot = sortedPurchases.find(l => String(l.ProductoID).trim() === pid && parseFloat(l.CantidadRestante) > EPSILON);
                costMap[pid] = oldestLot ? parseFloat(oldestLot.Costo) : 0;
            });
        }

        const productsArray = Array.isArray(productData) ? productData : (productData.Rows || []);
        products = productsArray.map(p => ({
            id: p.ID,
            name: p.Nombre,
            barcode: p.CodigoBarras || '',
            cost: costMap[p.ID] || 0,
            stock: parseFloat(p.Stock) || 0,
            category: p.Categoria
        }));

        renderProductGrid(products);
        updateSearchListener();
    }

    function renderProductGrid(productsToRender) {
        const grid = document.getElementById('dis-product-grid');
        if (!grid) return;
        grid.innerHTML = '';
        productsToRender.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card bg-white p-3 rounded-lg shadow cursor-pointer flex flex-col items-center text-center';
            card.onclick = () => addToCart(product.id);
            card.innerHTML = `
                <div class="text-lg font-bold text-gray-800 line-clamp-3 h-24 flex items-center justify-center mb-2 px-2 uppercase">${product.name}</div>
                <p class="text-red-600 font-bold mt-1">$${product.cost.toFixed(2)}</p>
                <p class="text-xs text-gray-500">Stock: ${product.stock}</p>
            `;
            grid.appendChild(card);
        });
    }

    function updateSearchListener() {
        const searchInput = document.getElementById('dis-product-search');
        if (!searchInput) return;
        searchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.barcode && p.barcode.toLowerCase().includes(query))
            );
            renderProductGrid(filtered);
        };
    }

    function addToCart(productIdOrBarcode) {
        const product = products.find(p => p.id === productIdOrBarcode || p.barcode === productIdOrBarcode);
        if (!product) { ui.showToast('Producto no encontrado', 'error'); return; }
        if (product.stock <= 0) { ui.showToast('Producto sin stock', 'error'); return; }

        const cartItem = cart.find(item => item.id === product.id);
        if (cartItem) {
            if (cartItem.quantity < product.stock) {
                cartItem.quantity++;
            } else {
                ui.showToast('No hay suficiente stock disponible', 'error');
                return;
            }
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        renderCart();
        ui.showToast(`${product.name} añadido a la lista`);
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        renderCart();
    }

    function updateQuantity(productId, delta) {
        const item = cart.find(i => i.id === productId);
        if (item) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) { removeFromCart(productId); return; }
            if (newQty > item.stock) { ui.showToast('Stock máximo alcanzado', 'error'); return; }
            item.quantity = newQty;
            renderCart();
        }
    }

    function setQuantity(productId, value) {
        const item = cart.find(i => i.id === productId);
        if (item) {
            const newQty = parseFloat(value) || 0;
            if (newQty <= 0) { removeFromCart(productId); return; }
            if (newQty > item.stock) {
                ui.showToast(`Stock máximo: ${item.stock}`, 'error');
                item.quantity = item.stock;
            } else {
                item.quantity = newQty;
            }
            renderCart();
        }
    }

    function renderCart() {
        const container = document.getElementById('dis-cart-items');
        const btnProcess = document.getElementById('btn-process-discards');
        if (!container || !btnProcess) return;

        if (cart.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">La lista está vacía</p>';
            btnProcess.disabled = true;
            updateTotals(0);
            return;
        }

        btnProcess.disabled = false;
        container.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            total += item.cost * item.quantity;

            const div = document.createElement('div');
            div.className = 'cart-item-added flex flex-col bg-gray-50 p-2 rounded border border-gray-200 mb-2';
            div.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <p class="text-sm font-bold truncate flex-grow">${item.name}</p>
                    <button onclick="discharges.removeFromCart('${item.id}')" class="ml-2 text-red-500 hover:text-red-700 shrink-0">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="flex items-center space-x-1">
                        <button onclick="discharges.updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 text-sm">-</button>
                        <input
                            type="number"
                            min="1"
                            max="${item.stock}"
                            value="${item.quantity}"
                            onchange="discharges.setQuantity('${item.id}', this.value)"
                            class="w-14 text-center text-sm font-bold border border-gray-300 rounded p-1 focus:ring-1 focus:ring-blue-400 outline-none"
                        >
                        <button onclick="discharges.updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 text-sm">+</button>
                    </div>
                    <span class="text-gray-400 text-xs">×</span>
                    <span class="text-sm font-bold text-red-600">$${item.cost.toFixed(2)}</span>
                    <span class="text-xs text-gray-500 ml-auto">= $${(item.cost * item.quantity).toFixed(2)}</span>
                </div>
            `;
            container.appendChild(div);
        });

        updateTotals(total);
    }

    function updateTotals(total) {
        const totalEl = document.getElementById('dis-cart-total');
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    }

    async function processDiscards() {
        if (cart.length === 0) return;

        const responsible = document.getElementById('dis-responsible').value.trim();
        const center = document.getElementById('dis-center').value;
        const reason = document.getElementById('dis-reason').value;

        if (!responsible) {
            ui.showToast('El nombre del responsable es obligatorio', 'error');
            return;
        }

        const reasonToId = {
            "Producto vencido": "SVTS00101",
            "Producto explotado": "SVTS00102",
            "Producto no apto para consumo": "SVTS00103"
        };

        const movementId = reasonToId[reason];
        const now = ui.formatDateForAPI(new Date());

        // Fetch all purchases once to avoid N+1 problem
        const allLotsData = await api.getRecords('Compras');
        if (!allLotsData) return;
        const allLots = Array.isArray(allLotsData) ? allLotsData : (allLotsData.Rows || []);

        const dischargeRows = [];
        const lotUpdates = [];

        for (const item of cart) {
            let remaining = item.quantity;
            const EPSILON = 0.0001;

            // Filter and sort lots for the current product
            const lots = allLots
                .filter(l => String(l.ProductoID).trim() === String(item.id).trim() && parseFloat(l.CantidadRestante) > EPSILON)
                .sort((a, b) => ui.parseAppSheetDate(a.FechaRegistro) - ui.parseAppSheetDate(b.FechaRegistro));

            for (const lot of lots) {
                if (remaining <= EPSILON) break;
                const lotQty = parseFloat(lot.CantidadRestante) || 0;
                const consume = Math.min(lotQty, remaining);

                dischargeRows.push({
                    IDTransaccion: Math.random().toString(36).substr(2, 9).toUpperCase(),
                    Usuario: responsible,
                    IDProducto: item.id,
                    FechaYHora: now,
                    Cantidad: consume,
                    TextoCabecera: reason,
                    ClaseDeMovimiento: movementId,
                    Centro: center
                });

                lotUpdates.push({
                    ID: lot.ID,
                    CantidadRestante: parseFloat((lotQty - consume).toFixed(4))
                });
                remaining -= consume;
            }

            // Fallback for missing lots
            if (remaining > EPSILON) {
                dischargeRows.push({
                    IDTransaccion: Math.random().toString(36).substr(2, 9).toUpperCase(),
                    Usuario: responsible,
                    IDProducto: item.id,
                    FechaYHora: now,
                    Cantidad: remaining,
                    TextoCabecera: reason,
                    ClaseDeMovimiento: movementId,
                    Centro: center
                });
            }
        }

        if (dischargeRows.length === 0) return;

        const result = await api.addRecords('DescargosDeInventario', dischargeRows);
        if (!result) return;

        if (lotUpdates.length > 0) await api.editRecords('Compras', lotUpdates);

        ui.showToast('Descargo registrado exitosamente', 'success');
        document.getElementById('dis-responsible').value = '';
        cart = [];
        renderCart();
        loadProducts();
    }

    return {
        loadProducts,
        addToCart,
        removeFromCart,
        updateQuantity,
        setQuantity,
        processDiscards
    };
})();
