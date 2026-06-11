/**
 * Inventory Module
 * Handles new stock registration and supply history
 */
const inventory = (function() {
    let products = [];

    async function init() {
        await loadProducts();
        setupForm();
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
        // Keep only the first default option
        select.innerHTML = '<option value="">Seleccione un producto...</option>';
        
        products.forEach(p => {
            const option = document.createElement('option');
            option.value = p.ID;
            option.textContent = `${p.Nombre} (${p.CodigoBarras || 'Sin código'})`;
            select.appendChild(option);
        });
    }

    function setupForm() {
        const form = document.getElementById('inventory-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const productID = document.getElementById('inv-product-select').value;
            const quantity = parseInt(document.getElementById('inv-quantity').value);
            const cost = parseFloat(document.getElementById('inv-cost').value);
            const price = parseFloat(document.getElementById('inv-price').value);
            const expiry = document.getElementById('inv-expiry').value;

            const purchaseData = {
                ID: Math.random().toString(36).substr(2, 9).toUpperCase(),
                ProductoID: productID,
                Cantidad: quantity,
                Costo: cost,
                PrecioVentaSugerido: price,
                FechaVencimiento: expiry,
                FechaRegistro: new Date().toISOString()
            };

            // 1. Add to Purchases table
            const purchaseResult = await api.addRecords('Compras', [purchaseData]);

            if (purchaseResult) {
                // 2. Update Product/Inventory table (Update price and increment stock)
                // Note: In AppSheet, usually stock is calculated or updated. 
                // Here we assume we update the 'Productos' table with the new price 
                // and the backend/AppSheet handles stock increment via formula or we do it manually.
                
                const product = products.find(p => p.ID === productID);
                const currentStock = parseInt(product.Stock) || 0;

                const productUpdate = {
                    ID: productID,
                    PrecioVenta: price,
                    Stock: currentStock + quantity
                };

                const updateResult = await api.editRecords('Productos', [productUpdate]);

                if (updateResult) {
                    ui.showToast('Abastecimiento registrado correctamente');
                    form.reset();
                    loadProducts(); // Refresh local list
                }
            }
        };
    }

    return {
        init
    };
})();
