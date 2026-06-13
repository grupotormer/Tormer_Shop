/**
 * POS Module
 * - Editable quantity and price in cart
 * - Tax 13% included in price (no added on top)
 * - FIFO lot management
 */
const pos = (function() {
    let products = [];
    let cart = [];
    const TAX_RATE = 0.13;

    async function loadProducts() {
        const productData = await api.getRecords('Productos');
        const salesData = await api.getRecords('Ventas');
        if (!productData) return;

        const popularityMap = {};
        if (salesData) {
            salesData.forEach(sale => {
                const pid = sale.ProductoID;
                popularityMap[pid] = (popularityMap[pid] || 0) + 1;
            });
        }

        products = productData.map(p => ({
            id: p.ID,
            name: p.Nombre,
            barcode: p.CodigoBarras || '',
            price: parseFloat(p.PrecioVenta) || 0,
            stock: parseInt(p.Stock) || 0,
            category: p.Categoria,
            image: p.Imagen || 'https://via.placeholder.com/150?text=' + encodeURIComponent(p.Nombre),
            salesCount: popularityMap[p.ID] || 0
        }));

        products.sort((a, b) => b.salesCount - a.salesCount);
        renderProductGrid(products);
        updateSearchListener();
    }

    function renderProductGrid(productsToRender) {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        productsToRender.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card bg-white p-3 rounded-lg shadow cursor-pointer flex flex-col items-center text-center';
            card.onclick = () => addToCart(product.id);
            card.innerHTML = `
                <img src="${product.image}" alt="${product.name}" class="w-24 h-24 object-cover mb-2 rounded">
                <h3 class="text-sm font-bold text-gray-800 line-clamp-2 h-10">${product.name}</h3>
                <p class="text-blue-600 font-bold mt-1">$${product.price.toFixed(2)}</p>
                <p class="text-xs text-gray-500">Stock: ${product.stock}</p>
            `;
            grid.appendChild(card);
        });
    }

    function updateSearchListener() {
        const searchInput = document.getElementById('product-search');
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
        ui.showToast(`${product.name} añadido`);
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
            const newQty = parseInt(value) || 0;
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

    function setPrice(productId, value) {
        const item = cart.find(i => i.id === productId);
        if (item) {
            const newPrice = parseFloat(value) || 0;
            if (newPrice < 0) return;
            item.price = newPrice;
            renderCart();
        }
    }

    function renderCart() {
        const container = document.getElementById('cart-items');
        const btnProcess = document.getElementById('btn-process-sale');

        if (cart.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">El carrito está vacío</p>';
            btnProcess.disabled = true;
            updateTotals(0);
            return;
        }

        btnProcess.disabled = false;
        container.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            // Price already includes tax, so total = price * qty
            total += item.price * item.quantity;

            const div = document.createElement('div');
            div.className = 'cart-item-added flex flex-col bg-gray-50 p-2 rounded border border-gray-200 mb-2';
            div.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <p class="text-sm font-bold truncate flex-grow">${item.name}</p>
                    <button onclick="pos.removeFromCart('${item.id}')" class="ml-2 text-red-500 hover:text-red-700 shrink-0">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="flex items-center space-x-1">
                        <button onclick="pos.updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 text-sm">-</button>
                        <input
                            type="number"
                            min="1"
                            max="${item.stock}"
                            value="${item.quantity}"
                            onchange="pos.setQuantity('${item.id}', this.value)"
                            class="w-14 text-center text-sm font-bold border border-gray-300 rounded p-1 focus:ring-1 focus:ring-blue-400 outline-none"
                        >
                        <button onclick="pos.updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 text-sm">+</button>
                    </div>
                    <span class="text-gray-400 text-xs">×</span>
                    <div class="flex items-center">
                        <span class="text-gray-500 text-xs mr-1">$</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value="${item.price.toFixed(2)}"
                            onchange="pos.setPrice('${item.id}', this.value)"
                            class="w-20 text-center text-sm font-bold text-blue-600 border border-gray-300 rounded p-1 focus:ring-1 focus:ring-blue-400 outline-none"
                        >
                    </div>
                    <span class="text-xs text-gray-500 ml-auto">= $${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `;
            container.appendChild(div);
        });

        updateTotals(total);
    }

    function updateTotals(total) {
        // Tax is already included in price
        const tax = total - (total / (1 + TAX_RATE));
        const subtotal = total - tax;

        document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
    }

    async function getFifoLots(productID) {
        const allLots = await api.getRecords('Compras');
        if (!allLots) return [];
        return allLots
            .filter(l => l.ProductoID === productID && parseInt(l.CantidadRestante) > 0)
            .sort((a, b) => new Date(a.FechaRegistro) - new Date(b.FechaRegistro));
    }

    async function processSale() {
        if (cart.length === 0) return;

        try {
            const now = new Date().toISOString();

            const saleRows = cart.map(item => ({
                ID: Math.random().toString(36).substr(2, 9).toUpperCase(),
                ProductoID: item.id,
                Cantidad: item.quantity,
                PrecioUnitario: item.price,
                Total: parseFloat((item.price * item.quantity).toFixed(2)),
                Fecha: now
            }));

            // 1. Get all relevant lots first to avoid repeated API calls
            const allLots = await api.getRecords('Compras');
            if (!allLots) throw new Error('No se pudo obtener la información de lotes');

            const lotUpdates = [];
            for (const item of cart) {
                let remaining = item.quantity;
                const itemLots = allLots
                    .filter(l => l.ProductoID === item.id && parseInt(l.CantidadRestante) > 0)
                    .sort((a, b) => new Date(a.FechaRegistro) - new Date(b.FechaRegistro));

                for (const lot of itemLots) {
                    if (remaining <= 0) break;
                    const lotQty = parseInt(lot.CantidadRestante) || 0;
                    const consume = Math.min(lotQty, remaining);
                    lotUpdates.push({ ID: lot.ID, CantidadRestante: lotQty - consume });
                    remaining -= consume;
                }

                if (remaining > 0) {
                    throw new Error(`Stock insuficiente para ${item.name} en los lotes disponibles`);
                }
            }

            // 2. Register Sales
            const saleResult = await api.addRecords('Ventas', saleRows);
            if (!saleResult) throw new Error('Error al registrar la venta');

            // 3. Update Lots
            if (lotUpdates.length > 0) {
                const updateResult = await api.editRecords('Compras', lotUpdates);
                if (!updateResult) throw new Error('Error al actualizar inventario (lotes)');
            }

            ui.showToast('Venta procesada exitosamente', 'success');

            // Success: clear cart and search
            cart = [];
            document.getElementById('product-search').value = '';
            renderCart();
            loadProducts();
        } catch (error) {
            console.error('Error en processSale:', error);
            ui.showToast(error.message || 'Error al procesar la venta', 'error');
        }
    }

    return {
        loadProducts,
        addToCart,
        removeFromCart,
        updateQuantity,
        setQuantity,
        setPrice,
        processSale
    };
})();
