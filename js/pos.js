/**
 * POS Module
 * Handles product catalog, search, sorting and shopping cart
 */
const pos = (function() {
    let products = [];
    let cart = [];
    const TAX_RATE = 0.16;

    /**
     * Loads products from AppSheet and sorts them by popularity
     */
    async function loadProducts() {
        const productData = await api.getRecords('Productos');
        const salesData = await api.getRecords('Ventas');

        if (!productData) return;

        // Calculate product popularity (frequency in sales history)
        const popularityMap = {};
        if (salesData) {
            salesData.forEach(sale => {
                const pid = sale.ProductoID;
                popularityMap[pid] = (popularityMap[pid] || 0) + 1;
            });
        }

        // Map and sort products
        products = productData.map(p => ({
            id: p.ID,
            name: p.Nombre,
            barcode: p.CodigoBarras,
            price: parseFloat(p.PrecioVenta) || 0,
            stock: parseInt(p.Stock) || 0,
            category: p.Categoria,
            image: p.Imagen || 'https://via.placeholder.com/150?text=' + encodeURIComponent(p.Nombre),
            salesCount: popularityMap[p.ID] || 0
        }));

        // Sort: Most sold first
        products.sort((a, b) => b.salesCount - a.salesCount);

        renderProductGrid(products);
        updateSearchListener();
    }

    /**
     * Renders the product grid
     * @param {Array} productsToRender 
     */
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
                p.barcode.toLowerCase().includes(query)
            );
            renderProductGrid(filtered);
        };
    }

    /**
     * Adds a product to the cart by its ID or Barcode
     */
    function addToCart(productIdOrBarcode) {
        const product = products.find(p => p.id === productIdOrBarcode || p.barcode === productIdOrBarcode);
        
        if (!product) {
            ui.showToast('Producto no encontrado', 'error');
            return;
        }

        if (product.stock <= 0) {
            ui.showToast('Producto sin stock', 'error');
            return;
        }

        const cartItem = cart.find(item => item.id === product.id);
        if (cartItem) {
            if (cartItem.quantity < product.stock) {
                cartItem.quantity++;
            } else {
                ui.showToast('No hay suficiente stock disponible', 'error');
                return;
            }
        } else {
            cart.push({
                ...product,
                quantity: 1
            });
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
            if (newQty > 0 && newQty <= item.stock) {
                item.quantity = newQty;
            } else if (newQty <= 0) {
                removeFromCart(productId);
                return;
            } else {
                ui.showToast('Stock máximo alcanzado', 'error');
            }
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
        let subtotal = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item-added flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200';
            div.innerHTML = `
                <div class="flex-grow">
                    <p class="text-sm font-bold truncate w-32">${item.name}</p>
                    <p class="text-xs text-gray-500">$${item.price.toFixed(2)} c/u</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="pos.updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300">-</button>
                    <span class="text-sm font-bold w-4 text-center">${item.quantity}</span>
                    <button onclick="pos.updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300">+</button>
                    <button onclick="pos.removeFromCart('${item.id}')" class="ml-2 text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        updateTotals(subtotal);
    }

    function updateTotals(subtotal) {
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
    }

    /**
     * Processes the sale and sends to AppSheet
     */
    async function processSale() {
        if (cart.length === 0) return;

        const saleRows = cart.map(item => ({
            ID: Math.random().toString(36).substr(2, 9).toUpperCase(), // Or let AppSheet handle it
            ProductoID: item.id,
            Cantidad: item.quantity,
            PrecioUnitario: item.price,
            Total: item.price * item.quantity,
            Fecha: new Date().toISOString()
        }));

        const result = await api.addRecords('Ventas', saleRows);

        if (result) {
            ui.showToast('Venta procesada exitosamente', 'success');
            cart = [];
            renderCart();
            loadProducts(); // Refresh stock and popularity
        }
    }

    return {
        loadProducts,
        addToCart,
        removeFromCart,
        updateQuantity,
        processSale
    };
})();
