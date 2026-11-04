import { AuthService } from './services/auth.service.js';
import { ApiService } from './services/api.service.js';
import { Store } from './state/store.js';

let currentTab = 'stock'; // 'stock' (Almacén) | 'tasks' (Tareas)
let showShoppingInStock = false; // Alterna entre Inventario y Lista de Compra dentro de Almacén

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

function updateHouseTabs() {
  document.querySelectorAll('.tab-house').forEach(btn => {
    const houseNum = btn.dataset.house;
    const customName = Store.houses[`NOMBRE_CASA_${houseNum}`];
    if (customName) {
      btn.textContent = customName;
    }
  });
}

async function loadInitialData() {
  const container = document.getElementById('content-container');
  container.innerHTML = '<div class="text-center text-slate-400 py-8">Cargando datos...</div>';
  try {
    const data = await ApiService.getInitialData();
    Store.setState({
      houses: data.houses || {},
      products: data.products || [],
      tasks: data.tasks || []
    });
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
      Store.setState({
        houses: data.houses || {},
        products: data.products || [],
        tasks: data.tasks || []
      });
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

  // Botón para alternar Lista Compra dentro de Almacén
  document.getElementById('btn-toggle-shopping').addEventListener('click', () => {
    showShoppingInStock = !showShoppingInStock;
    updateNavButtons();
    render();
  });

  // Tabs de navegación inferior
  document.getElementById('nav-stock').addEventListener('click', () => {
    currentTab = 'stock';
    updateNavButtons();
    render();
  });

  document.getElementById('nav-tasks').addEventListener('click', () => {
    currentTab = 'tasks';
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
  const btnTasks = document.getElementById('nav-tasks');
  const houseSelector = document.getElementById('house-selector');
  const btnToggleShopping = document.getElementById('btn-toggle-shopping');
  const title = document.getElementById('header-title');

  if (currentTab === 'stock') {
    btnStock.className = 'flex flex-col items-center flex-1 py-1 text-indigo-400 font-semibold text-xs';
    btnTasks.className = 'flex flex-col items-center flex-1 py-1 text-slate-400 font-semibold text-xs';
    btnToggleShopping.classList.remove('hidden');

    if (showShoppingInStock) {
      houseSelector.classList.add('hidden');
      title.textContent = 'Almacén · Lista Compra';
      btnToggleShopping.textContent = '📦 Ver Stock';
      btnToggleShopping.className = 'text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium active:scale-95 transition';
    } else {
      houseSelector.classList.remove('hidden');
      title.textContent = 'Almacén';
      btnToggleShopping.textContent = '🛒 Lista Compra';
      btnToggleShopping.className = 'text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 px-3 py-1.5 rounded-lg font-medium active:scale-95 transition';
    }
  } else {
    btnStock.className = 'flex flex-col items-center flex-1 py-1 text-slate-400 font-semibold text-xs';
    btnTasks.className = 'flex flex-col items-center flex-1 py-1 text-indigo-400 font-semibold text-xs';
    houseSelector.classList.add('hidden');
    btnToggleShopping.classList.add('hidden');
    title.textContent = 'Tareas';
  }
}

function render() {
  const container = document.getElementById('content-container');
  container.innerHTML = '';

  if (currentTab === 'stock') {
    if (showShoppingInStock) {
      renderShoppingView(container);
    } else {
      renderStockView(container);
    }
  } else {
    renderTasksView(container);
  }
}

function renderStockView(container) {
  const house = Store.activeHouse;
  if (!Store.products.length) {
    container.innerHTML = '<div class="text-center text-slate-400 py-8">No hay productos en el almacén.</div>';
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
      await ApiService.updateStock(prod.id
