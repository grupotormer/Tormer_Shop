/**
 * Inventory Module
 * Multi-product purchase registration + new product creation
 * NOTE: 'Stock' in Productos is an AppSheet formula column (auto-calculated
 * from sum of CantidadRestante in Compras) — never written via API.
 */
const inventory = (function() {
    let products = [];
    let purchaseItems = [];

    async function init() {
        await loadProducts();
        setupForm();
        renderPurchaseItems();
    }

    async function loadProducts() {
        const data = await api.getRecords('Productos');
        if (data) {
            products = data;
            renderProductSelect();
        }
    }

    function renderProductSelect() {
        const select = document.getElementById('inv-product-select');
        select.innerHTML = '<option value="">Seleccione un producto existente...</option><option value="__NEW__">+ Crear nuevo producto</option>';
        products.forEach(p => {
            const option = document.createElement('option');
            option.value = p.ID;
            option.textContent = `${p.Nombre} (${p.CodigoBarras || 'Sin código'})`;
            select.appendChild(option);
        });
    }

    function setupForm() {
        const select = document.getElementById('inv-product-select');
        select.onchange = () => {
            const newProductFields = document.getElementById('new-product-fields');
            if (select.value === '__NEW__') {
                newProductFields.classList.remove('hidden');
            } else {
                newProductFields.classList.add('hidden');
            }
        };

        document.getElementById('btn-add-purchase-item').onclick = addItemToList;

        const form = document.getElementById('inventory-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            if (purchaseItems.length === 0) {
                ui.showToast('Agrega al menos un producto', 'error');
                return;
            }
            await savePurchase();
        };
    }

    function addItemToList() {
        const selectEl = document.getElementById('inv-product-select');
        const quantity = parseFloat(document.getElementById('inv-quantity').value);
        const cost = parseFloat(document.getElementById('inv-cost').value);
        const price = parseFloat(document.getElementById('inv-price').value);
        const expiry = document.getElementById('inv-expiry').value;
        const isNew = selectEl.value === '__NEW__';

        if (!selectEl.value) { ui.showToast('Selecciona un producto', 'error'); return; }
        if (!quantity || quantity < 1) { ui.showToast('Ingresa una cantidad válida', 'error'); return; }
        if (!cost || cost <= 0) { ui.showToast('Ingresa un costo válido', 'error'); return; }
        if (!price || price <= 0) { ui.showToast('Ingresa un precio válido', 'error'); return; }

        let productName, productID;

        if (isNew) {
            const newName = document.getElementById('inv-new-name').value.trim();
            const newBarcode = document.getElementById('inv-new-barcode').value.trim();
            const newCategory = document.getElementById('inv-new-category').value.trim();
            if (!newName) { ui.showToast('Ingresa el nombre del nuevo producto', 'error'); return; }
            productID = '__NEW__' + Math.random().toString(36).substr(2, 6).toUpperCase();
            productName = newName;
            purchaseItems.push({ productID, productName, isNew: true, newBarcode, newCategory, quantity, cost, price, expiry });
        } else {
            productID = selectEl.value;
            const product = products.find(p => p.ID === productID);
            productName = product ? product.Nombre : productID;
            purchaseItems.push({ productID, productName, isNew: false, quantity, cost, price, expiry });
        }

        renderPurchaseItems();
        selectEl.value = '';
        document.getElementById('inv-quantity').value = '';
        document.getElementById('inv-cost').value = '';
        document.getElementById('inv-price').value = '';
        document.getElementById('inv-expiry').value = '';
        document.getElementById('new-product-fields').classList.add('hidden');
        ui.showToast(`${productName} agregado a la lista`);
    }

    function removeItem(index) {
        purchaseItems.splice(index, 1);
        renderPurchaseItems();
    }

    function renderPurchaseItems() {
        const container = document.getElementById('purchase-items-list');
        const btnSave = document.getElementById('btn-save-purchase');

        if (purchaseItems.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm text-center py-2">No hay productos agregados aún</p>';
            btnSave.disabled = true;
            return;
        }

        btnSave.disabled = false;
        container.innerHTML = '';
        purchaseItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-blue-50 border border-blue-200 rounded p-2 text-sm';
            div.innerHTML = `
                <div class="flex-grow">
                    <span class="font-bold text-gray-800">${item.productName}</span>
                    ${item.isNew ? '<span class="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">NUEVO</span>' : ''}
                    <div class="text-gray-500 text-xs">Qty: ${item.quantity} | Costo: $${item.cost.toFixed(2)} | Precio: $${item.price.toFixed(2)} ${item.expiry ? '| Vence: ' + item.expiry : ''}</div>
                </div>
                <button onclick="inventory.removeItem(${index})" class="ml-2 text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(div);
        });
    }

    async function savePurchase() {
        const comprasRows = [];
        const productosAdd = [];
        const productosEdit = [];

        for (const item of purchaseItems) {
            let realProductID = item.productID;

            if (item.isNew) {
                // Create the new product (Stock is a formula column — do NOT send it)
                realProductID = Math.random().toString(36).substr(2, 9).toUpperCase();
                productosAdd.push({
                    ID: realProductID,
                    Nombre: item.productName,
                    CodigoBarras: item.newBarcode || '',
                    Categoria: item.newCategory || '',
                    PrecioVenta: item.price
                });
            } else {
                // Only update price — Stock is a formula column, never edit it
                productosEdit.push({
                    ID: item.productID,
                    PrecioVenta: item.price
                });
            }

            comprasRows.push({
                ID: Math.random().toString(36).substr(2, 9).toUpperCase(),
                ProductoID: realProductID,
                Cantidad: item.quantity,
                CantidadRestante: item.quantity, // FIFO tracking — feeds the Stock formula
                Costo: item.cost,
                PrecioVentaSugerido: item.price,
                FechaVencimiento: item.expiry || '',
                FechaRegistro: ui.formatDateForAPI(new Date())
            });
        }

        // 1. Create new products if any
        if (productosAdd.length > 0) {
            const r = await api.addRecords('Productos', productosAdd);
            if (!r) return;
        }

        // 2. Update price on existing products
        if (productosEdit.length > 0) {
            const r = await api.editRecords('Productos', productosEdit);
            if (!r) return;
        }

        // 3. Save purchase lots (this feeds Stock via formula)
        const r = await api.addRecords('Compras', comprasRows);
        if (r) {
            ui.showToast(`Abastecimiento guardado: ${purchaseItems.length} producto(s)`, 'success');
            purchaseItems = [];
            renderPurchaseItems();
            await loadProducts();
        }
    }

    return {
        init,
        removeItem
    };
})();
