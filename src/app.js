import { AuthService } from './services/auth.service.js';
import { ApiService } from './services/api.service.js';
import { Store } from './state/store.js';

let currentTab = 'stock'; // 'stock' | 'shopping'

document.addEventListener('DOMContentLoaded', async () => {
    if (AuthService.isAuthenticated()) {
        showAppView();
        await loadInitialData();
    } else {
        showLoginView();
    }

    setupEventListeners();
});

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


function setupEventListeners() {
    // Login Form
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('login-url').value;
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const errBox = document.getElementById('login-error');
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

    // Tabs de navegación inferior
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

function updateNavButtons() {
    const btnStock = document.getElementById('nav-stock');
    const btnShop = document.getElementById('nav-shopping');
    const houseSelector = document.getElementById('house-selector');
    const title = document.getElementById('header-title');

    if (currentTab === 'stock') {
        btnStock.className = 'flex flex-col items-center flex-1 py-1 text-indigo-400 font-semibold text-xs';
        btnShop.className = 'flex flex-col items-center flex-1 py-1 text-slate-400 font-semibold text-xs';
        houseSelector.classList.remove('hidden');
        title.textContent = 'Inventario';
    } else {
        btnStock.className = 'flex flex-col items-center flex-1 py-1 text-slate-400 font-semibold text-xs';
        btnShop.className = 'flex flex-col items-center flex-1 py-1 text-indigo-400 font-semibold text-xs';
        houseSelector.classList.add('hidden');
        title.textContent = 'Lista de la Compra';
    }
}

/**
 * Actualiza el textContent de cada botón .tab-house con el nombre real de la
 * casa leído desde Store.houses["NOMBRE_CASA_N"].
 * Si la clave no existe en la configuración, conserva el fallback "Casa N".
 */
function updateHouseTabs() {
    if (!Store.houses) return;
    document.querySelectorAll('.tab-house').forEach(btn => {
        const name = Store.houses[`NOMBRE_CASA_${btn.dataset.house}`];
        if (name) btn.textContent = name;
    });
}

function render() {
    const container = document.getElementById('content-container');
    container.innerHTML = '';

    if (currentTab === 'stock') {
        renderStockView(container);
    } else {
        renderShoppingView(container);
    }
}

function renderStockView(container) {
    const house = Store.activeHouse;
    if (!Store.products.length) {
        container.innerHTML = '<div class="text-center text-slate-400 py-8">No hay productos en la base de datos.</div>';
        return;
    }

    Store.products.forEach(prod => {
        const stock = Number(prod[`stock_casa_${house}`] || 0);
        const min = Number(prod[`min_casa_${house}`] || 0);
        const isLow = stock < min;

        const card = document.createElement('div');
        card.className = 'bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center';
        card.innerHTML = `
      <div>
        <h4 class="font-semibold text-sm ${isLow ? 'text-amber-400' : 'text-slate-100'}">${prod.nombre}</h4>
        <span class="text-xs text-slate-400">${prod.categoria || 'General'} · Mínimo: ${min}</span>
      </div>
      <div class="flex items-center gap-3">
        <button class="btn-stock-dec w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg active:scale-95 transition">-</button>
        <span class="stock-val font-mono font-bold w-6 text-center text-sm">${stock}</span>
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
}

/**
 * Lee los supermercados configurados en Store.houses (claves NOMBRE_SUPER_N).
 * MERCADONA siempre está incluido como primero (fijo, usa API de precios).
 * Fallback: lista por defecto si el Sheet aún no tiene las claves.
 */
function getSupermarkets() {
    const supers = [];
    if (Store.houses) {
        for (let i = 1; i <= 10; i++) {
            const val = Store.houses[`NOMBRE_SUPER_${i}`];
            if (val) supers.push(String(val).toUpperCase().trim());
        }
    }
    // Fallback si el Sheet no tiene claves NOMBRE_SUPER_N todavía
    if (!supers.length) return ['MERCADONA', 'ALIMERKA', 'LIDL', 'ALDI'];
    // Garantizar que MERCADONA siempre esté primero
    const withoutMerca = supers.filter(s => s !== 'MERCADONA');
    return ['MERCADONA', ...withoutMerca];
}

/**
 * Muestra un bottom-sheet modal para elegir el supermercado de un producto.
 * @param {string} prodId - ID del producto
 * @param {string} currentPref - Preferencia actual (para marcar la activa)
 */
function showSuperModal(prodId, currentPref) {
    // Eliminar modal previo si existe
    document.getElementById('super-modal')?.remove();

    const supermarkets = getSupermarkets();

    // Mapa de colores por supermercado conocido
    const colorMap = {
        MERCADONA: { bg: '#065f46', border: '#10b981', badge: '🟢' },
        ALIMERKA:  { bg: '#78350f', border: '#f59e0b', badge: '🟡' },
        LIDL:      { bg: '#1e3a8a', border: '#60a5fa', badge: '🔵' },
        ALDI:      { bg: '#164e63', border: '#22d3ee', badge: '🩵' },
    };
    const defaultColor = { bg: '#1e293b', border: '#64748b', badge: '⚪' };

    const overlay = document.createElement('div');
    overlay.id = 'super-modal';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: flex-end; justify-content: center;
        animation: fadeIn .15s ease;
    `;

    const sheet = document.createElement('div');
    sheet.style.cssText = `
        background: #0f172a; border-top: 1px solid #334155;
        border-radius: 20px 20px 0 0; padding: 20px 16px 32px;
        width: 100%; max-width: 480px;
        animation: slideUp .2s ease;
    `;

    // Botones de supermercados
    const superBtns = supermarkets.map(name => {
        const c = colorMap[name] || defaultColor;
        const isActive = currentPref === name;
        return `
            <button class="super-opt-btn" data-super="${name}" style="
                width: 100%; padding: 13px 16px; margin-bottom: 10px;
                background: ${c.bg}; border: 2px solid ${isActive ? c.border : 'transparent'};
                border-radius: 12px; color: white; font-size: 15px; font-weight: 600;
                text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px;
                transition: border-color .15s, transform .1s; active: scale(.97);
            ">
                <span style="font-size:18px">${c.badge}</span>
                <span>${name}</span>
                ${isActive ? '<span style="margin-left:auto;font-size:11px;color:' + c.border + ';">✓ Activo</span>' : ''}
                ${name === 'MERCADONA' ? '<span style="margin-left:auto;font-size:10px;color:#6ee7b7;opacity:.8;">API precios</span>' : ''}
            </button>`;
    }).join('');

    sheet.innerHTML = `
        <div style="width:40px;height:4px;background:#334155;border-radius:4px;margin:0 auto 18px;"></div>
        <div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:16px;padding:0 4px;">
            📍 Fijar supermercado preferido
        </div>
        ${superBtns}
        <button id="super-auto-btn" style="
            width: 100%; padding: 13px 16px; margin-bottom: 10px;
            background: #1e293b; border: 2px solid ${!currentPref ? '#6366f1' : 'transparent'};
            border-radius: 12px; color: #94a3b8; font-size: 14px; font-weight: 500;
            text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px;
        ">
            <span style="font-size:18px">🤖</span>
            <span>Automático <span style="font-size:11px;opacity:.7;">(menor precio)</span></span>
            ${!currentPref ? '<span style="margin-left:auto;font-size:11px;color:#818cf8;">✓ Activo</span>' : ''}
        </button>
        <button id="super-cancel-btn" style="
            width: 100%; padding: 11px; background: transparent;
            border: 1px solid #334155; border-radius: 12px;
            color: #64748b; font-size: 14px; cursor: pointer; margin-top: 4px;
        ">Cancelar</button>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // Añadir keyframes si no existen
    if (!document.getElementById('modal-keyframes')) {
        const style = document.createElement('style');
        style.id = 'modal-keyframes';
        style.textContent = `
            @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
            @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        `;
        document.head.appendChild(style);
    }

    // Cerrar al pulsar el overlay
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('super-cancel-btn').addEventListener('click', () => overlay.remove());

    // Seleccionar automático
    document.getElementById('super-auto-btn').addEventListener('click', async () => {
        overlay.remove();
        await applyPreference(prodId, '');
    });

    // Seleccionar supermercado
    sheet.querySelectorAll('.super-opt-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const chosen = btn.dataset.super;
            overlay.remove();
            await applyPreference(prodId, chosen);
        });
    });
}

/** Aplica la preferencia al producto y actualiza la UI */
async function applyPreference(prodId, superName) {
    const p = Store.products.find(x => x.id_producto === prodId);
    if (p) p.super_forzado = superName;
    render();
    await ApiService.updatePreference(prodId, superName, null);
}

function renderShoppingView(container) {
    const missing = Store.getShoppingList();
    if (!missing.length) {
        container.innerHTML = '<div class="text-center text-emerald-400 py-12">🎉 ¡Todo el stock está cubierto en las 4 casas!</div>';
        return;
    }

    // Agrupar por supermercado óptimo
    const groups = {};
    missing.forEach(prod => {
        let superOptimo = prod.super_optimo;
        // Si viene vacío o con error de fórmula (#¡VALOR!, #N/A, etc.)
        if (!superOptimo || String(superOptimo).startsWith('#')) {
            superOptimo = 'POR DEFINIR / REVISAR';
        }
        if (!groups[superOptimo]) groups[superOptimo] = [];
        groups[superOptimo].push(prod);
    });

    // Paleta de colores por supermercado
    const colorMap = {
        MERCADONA:          'bg-emerald-800',
        ALIMERKA:           'bg-amber-700',
        LIDL:               'bg-blue-800',
        ALDI:               'bg-cyan-800',
        'POR DEFINIR / REVISAR': 'bg-rose-900',
    };

    Object.entries(groups).forEach(([superName, items]) => {
        const block = document.createElement('div');
        block.className = 'bg-slate-800 rounded-xl border border-slate-700 overflow-hidden';

        const headerBg = colorMap[superName] || 'bg-slate-700';

        block.innerHTML = `
      <div class="${headerBg} px-4 py-2 font-bold text-sm tracking-wide flex justify-between">
        <span>${superName}</span>
        <span class="text-xs font-normal opacity-90">${items.length} producto${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="divide-y divide-slate-700/60 p-2">
        ${items.map(item => `
          <div class="py-2.5 px-2 flex justify-between items-center text-sm">
            <div>
              <div class="font-medium text-slate-200">${item.nombre}</div>
              <div class="text-xs text-slate-400">
                Pref: <span class="font-medium ${item.super_forzado ? 'text-indigo-400' : 'text-slate-500'}">${item.super_forzado || 'Automático'}</span>
              </div>
            </div>
            <button class="btn-prefer text-xs px-3 py-1.5 rounded-lg border transition active:scale-95
                           ${item.super_forzado
                               ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30'
                               : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}"
                    data-id="${item.id_producto}"
                    data-pref="${item.super_forzado || ''}">
              ${item.super_forzado ? '✏️ Cambiar' : '📍 Fijar súper'}
            </button>
          </div>
        `).join('')}
      </div>
    `;

        block.querySelectorAll('.btn-prefer').forEach(btn => {
            btn.addEventListener('click', e => {
                const prodId = e.currentTarget.dataset.id;
                const currentPref = e.currentTarget.dataset.pref;
                showSuperModal(prodId, currentPref);
            });
        });

        container.appendChild(block);
    });
}