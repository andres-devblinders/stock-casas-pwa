import { AuthService } from './services/auth.service.js';
import { ApiService } from './services/api.service.js';
import { Store } from './state/store.js';

// ── Estado global de la app ──────────────────────────────────────────────────
let currentTab    = 'stock';   // 'stock' | 'shopping'
let currentSuper  = null;      // supermercado activo en la vista de compra
let shoppingCart  = {};        // { [prodId]: { qty: number, checked: boolean } }

// ── Paleta de colores por supermercado ───────────────────────────────────────
const SUPER_COLORS = {
    MERCADONA: { bg: '#065f46', border: '#10b981', badge: '🟢', cls: 'emerald' },
    ALIMERKA:  { bg: '#78350f', border: '#f59e0b', badge: '🟡', cls: 'amber'   },
    LIDL:      { bg: '#1e3a8a', border: '#60a5fa', badge: '🔵', cls: 'blue'    },
    ALDI:      { bg: '#164e63', border: '#22d3ee', badge: '🩵', cls: 'cyan'    },
};
const DEFAULT_COLOR = { bg: '#1e293b', border: '#64748b', badge: '⚪', cls: 'slate' };

// ────────────────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    injectGlobalStyles();
    if (AuthService.isAuthenticated()) {
        showAppView();
        await loadInitialData();
    } else {
        showLoginView();
    }
    setupEventListeners();
});

function injectGlobalStyles() {
    if (document.getElementById('app-global-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-global-styles';
    style.textContent = `
        @keyframes fadeIn  { from { opacity:0 }              to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes pop     { 0%,100% { transform:scale(1) }  50% { transform:scale(1.12) } }
        .item-bought { opacity:.45; text-decoration:line-through; }
        .cart-badge {
            position:absolute; top:-5px; right:-5px; background:#ef4444;
            color:white; font-size:10px; font-weight:700; border-radius:999px;
            padding:1px 5px; line-height:1.4; pointer-events:none;
        }
    `;
    document.head.appendChild(style);
}

// ────────────────────────────────────────────────────────────────────────────
// AUTH VIEWS
// ────────────────────────────────────────────────────────────────────────────
function showLoginView() {
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('view-app').classList.add('hidden');
}

function showAppView() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    const session = AuthService.getSession();
    document.getElementById('header-user').textContent = `Usuario: ${session.username || 'admin'}`;
}

async function loadInitialData() {
    const container = document.getElementById('content-container');
    container.innerHTML = '<div class="text-center text-slate-400 py-8">Cargando inventario...</div>';
    try {
        const data = await ApiService.getInitialData();
        Store.setState({ houses: data.houses, products: data.products });
        updateHouseTabs();
        render();
    } catch (err) {
        container.innerHTML = `<div class="text-center text-rose-400 py-8">${err.message}</div>`;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ────────────────────────────────────────────────────────────────────────────
function setupEventListeners() {
    // Login
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const url  = document.getElementById('login-url').value;
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const errBox    = document.getElementById('login-error');
        const submitBtn = document.getElementById('btn-login-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando credenciales...';
        errBox.classList.add('hidden');
        try {
            const data = await ApiService.login(url, user, pass);
            Store.setState({ houses: data.houses, products: data.products });
            updateHouseTabs();
            showAppView();
            render();
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Conectar y Guardar Sesión';
        }
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('¿Cerrar sesión en este dispositivo?')) {
            AuthService.logout();
            window.location.reload();
        }
    });

    // Nav tabs
    document.getElementById('nav-stock').addEventListener('click', () => {
        currentTab = 'stock';
        updateNavButtons();
        render();
    });
    document.getElementById('nav-shopping').addEventListener('click', () => {
        currentTab = 'shopping';
        updateNavButtons();
        render();
    });

    // Selector de casas
    document.querySelectorAll('.tab-house').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const houseId = Number(e.target.dataset.house);
            Store.setState({ activeHouse: houseId });
            document.querySelectorAll('.tab-house').forEach(b => {
                b.className = 'tab-house flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 whitespace-nowrap';
            });
            e.target.className = 'tab-house flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-indigo-600 text-white whitespace-nowrap';
            render();
        });
    });
}

// ────────────────────────────────────────────────────────────────────────────
// NAV & TABS
// ────────────────────────────────────────────────────────────────────────────
function updateNavButtons() {
    const btnStock    = document.getElementById('nav-stock');
    const btnShop     = document.getElementById('nav-shopping');
    const houseSelector = document.getElementById('house-selector');
    const title       = document.getElementById('header-title');

    if (currentTab === 'stock') {
        btnStock.className = 'flex flex-col items-center flex-1 py-1 text-indigo-400 font-semibold text-xs';
        btnShop.className  = 'flex flex-col items-center flex-1 py-1 text-slate-400 font-semibold text-xs';
        houseSelector.classList.remove('hidden');
        title.textContent = 'Inventario';
    } else {
        btnStock.className = 'flex flex-col items-center flex-1 py-1 text-slate-400 font-semibold text-xs';
        btnShop.className  = 'flex flex-col items-center flex-1 py-1 text-indigo-400 font-semibold text-xs';
        houseSelector.classList.add('hidden');
        title.textContent = 'Lista de la Compra';
    }
}

/**
 * Actualiza los botones .tab-house con los nombres reales de la hoja Configuracion.
 */
function updateHouseTabs() {
    if (!Store.houses) return;
    document.querySelectorAll('.tab-house').forEach(btn => {
        const name = Store.houses[`NOMBRE_CASA_${btn.dataset.house}`];
        if (name) btn.textContent = name;
    });
}

// ────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────
function render() {
    const container = document.getElementById('content-container');
    container.innerHTML = '';
    if (currentTab === 'stock') {
        renderStockView(container);
    } else {
        renderShoppingView(container);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA INVENTARIO
// ────────────────────────────────────────────────────────────────────────────
function renderStockView(container) {
    const house = Store.activeHouse;
    if (!Store.products.length) {
        container.innerHTML = '<div class="text-center text-slate-400 py-8">No hay productos en la base de datos.</div>';
        return;
    }

    // Agrupar por categoría
    const byCategory = {};
    Store.products.forEach(prod => {
        const cat = prod.categoria || 'General';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(prod);
    });

    Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, prods]) => {
        const section = document.createElement('div');
        section.innerHTML = `<div class="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 pt-4 pb-1">${cat}</div>`;
        container.appendChild(section);

        prods.forEach(prod => {
            const stock = Number(prod[`stock_casa_${house}`] || 0);
            const min   = Number(prod[`min_casa_${house}`]   || 0);
            const isLow = stock < min;

            const card = document.createElement('div');
            card.className = 'bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center mb-2';
            card.innerHTML = `
              <div>
                <h4 class="font-semibold text-sm ${isLow ? 'text-amber-400' : 'text-slate-100'}">${prod.nombre}</h4>
                <span class="text-xs text-slate-400">Mín: ${min}${isLow ? ' · ⚠️ stock bajo' : ''}</span>
              </div>
              <div class="flex items-center gap-3">
                <button class="btn-stock-dec w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg active:scale-95 transition">-</button>
                <span class="stock-val font-mono font-bold w-6 text-center text-sm ${isLow ? 'text-amber-400' : ''}">${stock}</span>
                <button class="btn-stock-inc w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg active:scale-95 transition">+</button>
              </div>
            `;

            card.querySelector('.btn-stock-dec').addEventListener('click', async () => {
                const newStock = Math.max(0, stock - 1);
                prod[`stock_casa_${house}`] = newStock;
                render();
                await ApiService.updateStock(prod.id_producto, house, newStock);
            });
            card.querySelector('.btn-stock-inc').addEventListener('click', async () => {
                const newStock = stock + 1;
                prod[`stock_casa_${house}`] = newStock;
                render();
                await ApiService.updateStock(prod.id_producto, house, newStock);
            });

            container.appendChild(card);
        });
    });
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS SUPERMERCADOS
// ────────────────────────────────────────────────────────────────────────────
function getSupermarkets() {
    const supers = [];
    if (Store.houses) {
        for (let i = 1; i <= 10; i++) {
            const val = Store.houses[`NOMBRE_SUPER_${i}`];
            if (val) supers.push(String(val).toUpperCase().trim());
        }
    }
    if (!supers.length) return ['MERCADONA', 'ALIMERKA', 'LIDL', 'ALDI'];
    const withoutMerca = supers.filter(s => s !== 'MERCADONA');
    return ['MERCADONA', ...withoutMerca];
}

function getSuperColor(name) {
    return SUPER_COLORS[name] || DEFAULT_COLOR;
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA LISTA DE COMPRA
// ────────────────────────────────────────────────────────────────────────────
function renderShoppingView(container) {
    const missing = Store.getShoppingList();
    if (!missing.length) {
        container.innerHTML = '<div class="text-center text-emerald-400 py-12">🎉 ¡Todo el stock está cubierto en las 4 casas!</div>';
        return;
    }

    // Agrupar todos los productos por su supermercado óptimo
    const bySuper = {};
    missing.forEach(prod => {
        let s = prod.super_optimo;
        if (!s || String(s).startsWith('#')) s = 'POR DEFINIR';
        if (!bySuper[s]) bySuper[s] = [];
        bySuper[s].push(prod);
    });

    // Lista de supers que tienen productos pendientes
    const activeSuperList = Object.keys(bySuper);

    // Si el super activo ya no tiene productos, resetear
    if (!currentSuper || !activeSuperList.includes(currentSuper)) {
        currentSuper = activeSuperList[0] || null;
    }

    // ── Tabs de supermercados ──────────────────────────────────────────────
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex; gap:8px; overflow-x:auto; padding:4px 0 12px; scrollbar-width:none;';

    activeSuperList.forEach(sName => {
        const c    = getSuperColor(sName);
        const count = bySuper[sName].length;
        const isActive = sName === currentSuper;

        const tab = document.createElement('button');
        tab.style.cssText = `
            flex-shrink:0; padding:8px 16px; border-radius:999px; font-size:13px;
            font-weight:600; border:2px solid ${isActive ? c.border : '#334155'};
            background:${isActive ? c.bg : '#1e293b'}; color:${isActive ? 'white' : '#94a3b8'};
            cursor:pointer; transition:all .15s; white-space:nowrap; position:relative;
        `;
        tab.innerHTML = `${c.badge} ${sName} <span style="
            display:inline-block; background:${isActive ? 'rgba(255,255,255,.25)' : '#334155'};
            border-radius:999px; padding:0 6px; font-size:11px; margin-left:4px;
        ">${count}</span>`;

        tab.addEventListener('click', () => {
            currentSuper = sName;
            render();
        });
        tabBar.appendChild(tab);
    });
    container.appendChild(tabBar);

    if (!currentSuper) return;

    const items = bySuper[currentSuper] || [];
    const c     = getSuperColor(currentSuper);

    // ── Header del supermercado activo ────────────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = `
        background:${c.bg}; border:1px solid ${c.border}33;
        border-radius:14px; padding:12px 16px; margin-bottom:12px;
        display:flex; align-items:center; justify-content:space-between;
    `;
    const checked  = Object.values(shoppingCart).filter(v => v.checked).length;
    const houseNum = Store.activeHouse;
    const houseName = (Store.houses && Store.houses[`NOMBRE_CASA_${houseNum}`]) || `Casa ${houseNum}`;
    header.innerHTML = `
        <div>
            <div style="font-size:18px; font-weight:700; color:white;">${c.badge} ${currentSuper}</div>
            <div style="font-size:12px; color:rgba(255,255,255,.65); margin-top:2px;">
                ${items.length} producto${items.length !== 1 ? 's' : ''} · Para: <b>${houseName}</b>
            </div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:22px; font-weight:800; color:white;">${checked}</div>
            <div style="font-size:10px; color:rgba(255,255,255,.6);">completados</div>
        </div>
    `;
    container.appendChild(header);

    // ── Selector de casa destino ───────────────────────────────────────────
    const houseBar = document.createElement('div');
    houseBar.style.cssText = 'display:flex; gap:6px; margin-bottom:12px; overflow-x:auto; scrollbar-width:none;';
    for (let h = 1; h <= 4; h++) {
        const hName = (Store.houses && Store.houses[`NOMBRE_CASA_${h}`]) || `Casa ${h}`;
        const isActive = h === Store.activeHouse;
        const hBtn = document.createElement('button');
        hBtn.style.cssText = `
            flex-shrink:0; padding:5px 12px; border-radius:8px; font-size:12px;
            font-weight:600; border:1px solid ${isActive ? '#6366f1' : '#334155'};
            background:${isActive ? '#3730a3' : '#1e293b'};
            color:${isActive ? 'white' : '#64748b'}; cursor:pointer; transition:all .15s;
        `;
        hBtn.textContent = hName;
        hBtn.addEventListener('click', () => {
            Store.setState({ activeHouse: h });
            // Actualizar también los botones del house-selector del header
            document.querySelectorAll('.tab-house').forEach((b, idx) => {
                const num = idx + 1;
                b.className = `tab-house flex-1 py-1.5 px-3 rounded-lg text-xs font-medium ${num === h ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'} whitespace-nowrap`;
            });
            render();
        });
        houseBar.appendChild(hBtn);
    }
    container.appendChild(houseBar);

    // ── Productos agrupados por categoría ─────────────────────────────────
    const byCategory = {};
    items.forEach(prod => {
        const cat = prod.categoria || 'General';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(prod);
    });

    Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, prods]) => {
        // Cabecera de categoría
        const catHeader = document.createElement('div');
        catHeader.style.cssText = `
            font-size:11px; font-weight:700; color:#64748b;
            text-transform:uppercase; letter-spacing:.08em;
            padding:8px 4px 4px; margin-top:4px;
            border-bottom:1px solid #1e293b; margin-bottom:4px;
        `;
        catHeader.textContent = cat;
        container.appendChild(catHeader);

        prods.forEach(prod => {
            const prodId   = prod.id_producto;
            const cartItem = shoppingCart[prodId] || { checked: false, qty: 1 };
            const stock    = Number(prod[`stock_casa_${houseNum}`] || 0);
            const min      = Number(prod[`min_casa_${houseNum}`]   || 0);
            const needed   = Math.max(0, min - stock);

            const row = document.createElement('div');
            row.style.cssText = `
                background:#1e293b; border:1px solid ${cartItem.checked ? c.border + '55' : '#334155'};
                border-radius:12px; padding:10px 12px; margin-bottom:6px;
                display:flex; align-items:center; gap:10px;
                transition:all .2s; ${cartItem.checked ? 'opacity:.6;' : ''}
            `;

            row.innerHTML = `
                <!-- Checkbox -->
                <button class="check-btn" data-id="${prodId}" style="
                    flex-shrink:0; width:26px; height:26px; border-radius:8px;
                    border:2px solid ${cartItem.checked ? c.border : '#475569'};
                    background:${cartItem.checked ? c.bg : 'transparent'};
                    color:white; font-size:14px; cursor:pointer; transition:all .15s;
                    display:flex; align-items:center; justify-content:center;
                ">${cartItem.checked ? '✓' : ''}</button>

                <!-- Info producto -->
                <div style="flex:1; min-width:0;">
                    <div style="font-size:14px; font-weight:600; color:${cartItem.checked ? '#64748b' : '#e2e8f0'};
                         ${cartItem.checked ? 'text-decoration:line-through;' : ''}
                         white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${prod.nombre}
                    </div>
                    <div style="font-size:11px; color:#64748b; margin-top:1px;">
                        Stock: ${stock} · Mín: ${min}
                        ${needed > 0 ? `· <span style="color:#f59e0b;">Necesitas ~${needed}</span>` : ''}
                    </div>
                </div>

                <!-- Stepper de cantidad comprada -->
                <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                    <button class="qty-dec" data-id="${prodId}" style="
                        width:28px; height:28px; border-radius:7px; border:1px solid #334155;
                        background:#0f172a; color:#94a3b8; font-size:16px; cursor:pointer;
                        display:flex; align-items:center; justify-content:center; transition:.1s;
                    ">−</button>
                    <span class="qty-val" style="
                        width:28px; text-align:center; font-size:15px; font-weight:700;
                        color:${cartItem.checked ? c.border : '#e2e8f0'}; font-family:monospace;
                    ">${cartItem.qty}</span>
                    <button class="qty-inc" data-id="${prodId}" style="
                        width:28px; height:28px; border-radius:7px; border:1px solid #334155;
                        background:#0f172a; color:#94a3b8; font-size:16px; cursor:pointer;
                        display:flex; align-items:center; justify-content:center; transition:.1s;
                    ">+</button>
                </div>

                <!-- Botón fijar súper -->
                <button class="btn-prefer" data-id="${prodId}" data-pref="${prod.super_forzado || ''}" style="
                    flex-shrink:0; padding:4px 8px; border-radius:7px;
                    border:1px solid #334155; background:#0f172a;
                    color:#64748b; font-size:11px; cursor:pointer;
                ">📍</button>
            `;

            // Checkbox toggle
            row.querySelector('.check-btn').addEventListener('click', () => {
                if (!shoppingCart[prodId]) shoppingCart[prodId] = { checked: false, qty: needed || 1 };
                shoppingCart[prodId].checked = !shoppingCart[prodId].checked;
                renderShoppingView(clearAndGetContainer());
            });

            // Qty stepper
            row.querySelector('.qty-dec').addEventListener('click', () => {
                if (!shoppingCart[prodId]) shoppingCart[prodId] = { checked: false, qty: needed || 1 };
                shoppingCart[prodId].qty = Math.max(1, (shoppingCart[prodId].qty || 1) - 1);
                renderShoppingView(clearAndGetContainer());
            });
            row.querySelector('.qty-inc').addEventListener('click', () => {
                if (!shoppingCart[prodId]) shoppingCart[prodId] = { checked: false, qty: needed || 1 };
                shoppingCart[prodId].qty = (shoppingCart[prodId].qty || 1) + 1;
                renderShoppingView(clearAndGetContainer());
            });

            // Fijar súper
            row.querySelector('.btn-prefer').addEventListener('click', e => {
                showSuperModal(e.currentTarget.dataset.id, e.currentTarget.dataset.pref);
            });

            container.appendChild(row);
        });
    });

    // ── Botón "Aplicar compra" ─────────────────────────────────────────────
    const checkedItems = items.filter(p => shoppingCart[p.id_producto]?.checked);
    if (checkedItems.length > 0) {
        const applyBtn = document.createElement('button');
        applyBtn.style.cssText = `
            width:100%; margin-top:16px; padding:16px;
            background:${c.bg}; border:2px solid ${c.border};
            border-radius:16px; color:white; font-size:16px; font-weight:700;
            cursor:pointer; transition:all .15s; letter-spacing:.02em;
        `;
        applyBtn.innerHTML = `✅ Aplicar compra (${checkedItems.length} producto${checkedItems.length !== 1 ? 's' : ''}) → ${houseName}`;
        applyBtn.addEventListener('click', () => applyPurchase(checkedItems, houseNum));
        container.appendChild(applyBtn);
    }

    // ── Botón "Fijar súper" masivo (si hay items sin asignar) ─────────────
    const unassigned = items.filter(p => !p.super_forzado);
    if (currentSuper === 'POR DEFINIR' && unassigned.length) {
        const assignBtn = document.createElement('button');
        assignBtn.style.cssText = `
            width:100%; margin-top:8px; padding:12px;
            background:#1e293b; border:1px dashed #475569;
            border-radius:12px; color:#94a3b8; font-size:13px;
            cursor:pointer;
        `;
        assignBtn.textContent = `📍 Asignar supermercado a estos ${unassigned.length} productos`;
        assignBtn.addEventListener('click', () => showBulkSuperModal(unassigned));
        container.appendChild(assignBtn);
    }
}

/** Helper: limpia el contenedor y lo devuelve (para re-renders parciales) */
function clearAndGetContainer() {
    const container = document.getElementById('content-container');
    container.innerHTML = '';
    return container;
}

// ────────────────────────────────────────────────────────────────────────────
// APLICAR COMPRA
// ────────────────────────────────────────────────────────────────────────────
async function applyPurchase(checkedItems, houseNum) {
    const btn = document.querySelector('button[style*="Aplicar compra"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    const promises = checkedItems.map(async prod => {
        const cartItem = shoppingCart[prod.id_producto];
        const currentStock = Number(prod[`stock_casa_${houseNum}`] || 0);
        const newStock = currentStock + (cartItem?.qty || 1);
        prod[`stock_casa_${houseNum}`] = newStock;
        delete shoppingCart[prod.id_producto]; // Limpiar del carrito
        await ApiService.updateStock(prod.id_producto, houseNum, newStock);
    });

    await Promise.all(promises);
    render(); // Re-renderiza: los productos con stock suficiente desaparecen
}

// ────────────────────────────────────────────────────────────────────────────
// MODAL SELECTOR DE SUPERMERCADO
// ────────────────────────────────────────────────────────────────────────────
function showSuperModal(prodId, currentPref) {
    document.getElementById('super-modal')?.remove();

    const supermarkets = getSupermarkets();
    const overlay = document.createElement('div');
    overlay.id = 'super-modal';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:1000;
        background:rgba(0,0,0,0.65); backdrop-filter:blur(4px);
        display:flex; align-items:flex-end; justify-content:center;
        animation:fadeIn .15s ease;
    `;

    const sheet = document.createElement('div');
    sheet.style.cssText = `
        background:#0f172a; border-top:1px solid #334155;
        border-radius:20px 20px 0 0; padding:20px 16px 32px;
        width:100%; max-width:480px; animation:slideUp .2s ease;
    `;

    const superBtns = supermarkets.map(name => {
        const c = getSuperColor(name);
        const isActive = currentPref === name;
        return `<button class="super-opt-btn" data-super="${name}" style="
            width:100%; padding:13px 16px; margin-bottom:8px;
            background:${c.bg}; border:2px solid ${isActive ? c.border : 'transparent'};
            border-radius:12px; color:white; font-size:15px; font-weight:600;
            text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px;
        ">
            <span style="font-size:18px">${c.badge}</span>
            <span>${name}</span>
            ${isActive ? `<span style="margin-left:auto;font-size:11px;color:${c.border};">✓ Activo</span>` : ''}
            ${name === 'MERCADONA' ? '<span style="margin-left:auto;font-size:10px;color:#6ee7b7;opacity:.8;">API precios</span>' : ''}
        </button>`;
    }).join('');

    sheet.innerHTML = `
        <div style="width:40px;height:4px;background:#334155;border-radius:4px;margin:0 auto 18px;"></div>
        <div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:14px;">📍 Fijar supermercado preferido</div>
        ${superBtns}
        <button id="super-auto-btn" style="
            width:100%; padding:13px 16px; margin-bottom:8px;
            background:#1e293b; border:2px solid ${!currentPref ? '#6366f1' : 'transparent'};
            border-radius:12px; color:#94a3b8; font-size:14px; font-weight:500;
            text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px;
        ">
            <span style="font-size:18px">🤖</span>
            <span>Automático <span style="font-size:11px;opacity:.7;">(menor precio)</span></span>
            ${!currentPref ? '<span style="margin-left:auto;font-size:11px;color:#818cf8;">✓ Activo</span>' : ''}
        </button>
        <button id="super-cancel-btn" style="
            width:100%; padding:11px; background:transparent;
            border:1px solid #334155; border-radius:12px;
            color:#64748b; font-size:14px; cursor:pointer; margin-top:4px;
        ">Cancelar</button>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('super-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('super-auto-btn').addEventListener('click', async () => {
        overlay.remove();
        await applyPreference(prodId, '');
    });
    sheet.querySelectorAll('.super-opt-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const chosen = btn.dataset.super;
            overlay.remove();
            await applyPreference(prodId, chosen);
        });
    });
}

/** Asigna el mismo supermercado a un lote de productos de una vez */
function showBulkSuperModal(prods) {
    document.getElementById('super-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'super-modal';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:1000;
        background:rgba(0,0,0,0.65); backdrop-filter:blur(4px);
        display:flex; align-items:flex-end; justify-content:center;
        animation:fadeIn .15s ease;
    `;
    const sheet = document.createElement('div');
    sheet.style.cssText = `
        background:#0f172a; border-top:1px solid #334155;
        border-radius:20px 20px 0 0; padding:20px 16px 32px;
        width:100%; max-width:480px; animation:slideUp .2s ease;
    `;

    const superBtns = getSupermarkets().map(name => {
        const c = getSuperColor(name);
        return `<button class="bulk-super-btn" data-super="${name}" style="
            width:100%; padding:13px 16px; margin-bottom:8px;
            background:${c.bg}; border:2px solid transparent;
            border-radius:12px; color:white; font-size:15px; font-weight:600;
            text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px;
        "><span>${c.badge}</span><span>${name}</span></button>`;
    }).join('');

    sheet.innerHTML = `
        <div style="width:40px;height:4px;background:#334155;border-radius:4px;margin:0 auto 18px;"></div>
        <div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:6px;">📍 Asignar a ${prods.length} productos</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:14px;">Se asignará el mismo súper a todos los productos sin preferencia.</div>
        ${superBtns}
        <button id="bulk-cancel-btn" style="
            width:100%; padding:11px; background:transparent;
            border:1px solid #334155; border-radius:12px;
            color:#64748b; font-size:14px; cursor:pointer; margin-top:4px;
        ">Cancelar</button>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('bulk-cancel-btn').addEventListener('click', () => overlay.remove());
    sheet.querySelectorAll('.bulk-super-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const chosen = btn.dataset.super;
            overlay.remove();
            await Promise.all(prods.map(p => applyPreference(p.id_producto, chosen)));
            currentSuper = chosen;
            render();
        });
    });
}

/** Aplica la preferencia de supermercado a un producto y re-renderiza */
async function applyPreference(prodId, superName) {
    const p = Store.products.find(x => x.id_producto === prodId);
    if (p) p.super_forzado = superName;
    render();
    await ApiService.updatePreference(prodId, superName, null);
}