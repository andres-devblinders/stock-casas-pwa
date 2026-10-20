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
 * casa leído desde Store.houses ("NOMBRE_CASA_1", "NOMBRE_CASA_2", ...).
 * Si la clave no existe en la configuración, conserva el fallback "Casa N".
 */
function updateHouseTabs() {
    document.querySelectorAll('.tab-house').forEach(btn => {
        const houseNum = btn.dataset.house;
        const name = Store.houses && Store.houses[`NOMBRE_CASA_${houseNum}`];
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

    Object.entries(groups).forEach(([superName, items]) => {
        const block = document.createElement('div');
        block.className = 'bg-slate-800 rounded-xl border border-slate-700 overflow-hidden';

        let headerBg = 'bg-slate-700';
        if (superName === 'MERCADONA') headerBg = 'bg-emerald-800';
        if (superName === 'ALIMERKA') headerBg = 'bg-amber-700';
        if (superName === 'LIDL') headerBg = 'bg-blue-800';
        if (superName === 'ALDI') headerBg = 'bg-cyan-800';

        block.innerHTML = `
      <div class="${headerBg} px-4 py-2 font-bold text-sm tracking-wide flex justify-between">
        <span>${superName}</span>
        <span class="text-xs font-normal opacity-90">${items.length} productos</span>
      </div>
      <div class="divide-y divide-slate-700/60 p-2">
        ${items.map(item => `
          <div class="py-2.5 px-2 flex justify-between items-center text-sm">
            <div>
              <div class="font-medium text-slate-200">${item.nombre}</div>
              <div class="text-xs text-slate-400">Pref: ${item.super_forzado || 'Automático'}</div>
            </div>
            <button class="btn-prefer text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded border border-slate-600 active:scale-95 transition"
                    data-id="${item.id_producto}">
              Fijar Súper
            </button>
          </div>
        `).join('')}
      </div>
    `;

        block.querySelectorAll('.btn-prefer').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const prodId = e.target.dataset.id;
                const choice = prompt('Introduce el nombre del súper preferido para este producto (MERCADONA, ALIMERKA, LIDL, ALDI) o déjalo vacío para automático por precio:');
                if (choice !== null) {
                    const upper = choice.trim().toUpperCase();
                    await ApiService.updatePreference(prodId, upper, null);
                    const p = Store.products.find(x => x.id_producto === prodId);
                    if (p) p.super_forzado = upper;
                    render();
                }
            });
        });

        container.appendChild(block);
    });
}