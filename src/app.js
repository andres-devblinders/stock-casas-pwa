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

  const groups = {};
  missing.forEach(prod => {
    let superOptimo = prod.super_optimo;
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
        const choice = prompt('Introduce el nombre del súper preferido (MERCADONA, ALIMERKA, LIDL, ALDI) o déjalo vacío para automático:');
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

function renderTasksView(container) {

  const owner = String(task.en_progreso_por || '').trim();
  const timestamp = Number(task.inicio_timestamp || 0);
    
  // Está en progreso REAL solo si hay dueño Y tiene timestamp de inicio activo
  const isProgress = Boolean(owner && timestamp > 0);
  const isMine = isProgress && owner.toLowerCase() === currentUser;

  // Si no está en curso, 'owner' pasa a ser simplemente el último usuario que la hizo
  const lastUser = (!isProgress && owner) ? owner : 'Nadie';
  
  if (!Store.tasks || !Store.tasks.length) {
    container.innerHTML = '<div class="text-center text-slate-400 py-8">No hay tareas registradas en la hoja Tareas.</div>';
    return;
  }

  const currentUser = String(AuthService.getSession().username || '').trim().toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0]; // Fecha actual YYYY-MM-DD

  // 1. Enriquecer y clasificar cada tarea con su prioridad exacta
  const processedTasks = Store.tasks.map(task => {
    const owner = String(task.en_progreso_por || '').trim();
    const isProgress = Boolean(owner);
    const isMine = owner && owner.toLowerCase() === currentUser;

    // Calcular días de diferencia con la fecha 'próxima' (columna G)
    // proxDate - today: si es negativo, está vencida; si es 0, es hoy; si es positivo, es futura.
    let diffDays = 0;
    if (task.próxima) {
      const taskDate = new Date(task.próxima);
      const todayDate = new Date(todayStr);
      diffDays = Math.round((taskDate - todayDate) / (1000 * 60 * 60 * 24));
    }

    // Definir prioridad numérica para el orden solicitado:
    // Prioridad 1: En progreso por cualquier usuario
    // Prioridad 2: Vencidas (diffDays < 0), ordenadas de mayor a menor días vencidos (más negativo primero)
    // Prioridad 3: De hoy (diffDays === 0)
    // Prioridad 4: Futuras (diffDays > 0), ordenadas de menor a mayor días restantes
    let priority = 4;
    let subSort = diffDays;

    if (isProgress) {
      priority = 1;
    } else if (diffDays < 0) {
      priority = 2;
      subSort = diffDays; // Más negativo = más días vencida (queremos que aparezca antes o ordenadas de mayor retraso)
    } else if (diffDays === 0) {
      priority = 3;
    } else {
      priority = 4;
      subSort = diffDays; // Menor días restantes primero
    }

    return {
      ...task,
      owner,
      isProgress,
      isMine,
      diffDays,
      priority,
      subSort,
      zona: String(task.zona || 'General').trim()
    };
  });

  // 2. Ordenar globalmente según las reglas de negocio
  processedTasks.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Dentro de la misma prioridad, ordenar según el subcriterio
    if (a.priority === 2) {
      return a.subSort - b.subSort; // Las más vencidas (número más negativo) primero
    }
    if (a.priority === 4) {
      return a.subSort - b.subSort; // Las que antes entran en escena (menor días) primero
    }
    return String(a.tarea).localeCompare(String(b.tarea));
  });

  // 3. Agrupar por bloques de ubicación (zona) manteniendo el orden de prioridad
  const zoneGroups = {};
  processedTasks.forEach(task => {
    const zone = task.zona;
    if (!zoneGroups[zone]) zoneGroups[zone] = [];
    zoneGroups[zone].push(task);
  });

  // Renderizar los bloques por ubicación
  container.innerHTML = '';
  
  Object.entries(zoneGroups).forEach(([zoneName, tasksInZone]) => {
    const zoneSection = document.createElement('div');
    zoneSection.className = 'space-y-2 mb-4';

    // Cabecera de la ubicación
    zoneSection.innerHTML = `
      <div class="flex items-center justify-between bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
        <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-400">📍 ${zoneName}</h3>
        <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">${tasksInZone.length} tareas</span>
      </div>
      <div class="space-y-2" id="zone-cards-${zoneName.replace(/\s+/g, '-')}"></div>
    `;

    const cardsContainer = zoneSection.querySelector(`#zone-cards-${zoneName.replace(/\s+/g, '-')}`);

    tasksInZone.forEach(task => {
      let actionButtonHtml = '';
      if (!task.isProgress) {
        actionButtonHtml = `
          <button class="btn-task-start bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition whitespace-nowrap">
            Iniciar
          </button>
        `;
      } else if (task.isMine) {
        actionButtonHtml = `
          <button class="btn-task-finish bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition whitespace-nowrap animate-pulse">
            Finalizar
          </button>
        `;
      } else {
        actionButtonHtml = `
          <button disabled class="bg-slate-700 text-slate-400 text-[11px] font-medium px-2.5 py-1.5 rounded-lg cursor-not-allowed whitespace-nowrap border border-slate-600">
            En progreso (${task.owner})
          </button>
        `;
      }

      // Etiqueta visual de estado temporal (Vencida, Hoy, Futura o En curso)
      let badgeHtml = '';
      if (task.isProgress) {
        badgeHtml = `<span class="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">En curso</span>`;
      } else if (task.diffDays < 0) {
        badgeHtml = `<span class="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">Vencida (${Math.abs(task.diffDays)}d)</span>`;
      } else if (task.diffDays === 0) {
        badgeHtml = `<span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Toca hoy</span>`;
      } else {
        badgeHtml = `<span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">En ${task.diffDays}d</span>`;
      }

      const card = document.createElement('div');
      card.className = 'bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center gap-2';
      card.innerHTML = `
        <div class="space-y-1 overflow-hidden">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="font-semibold text-sm text-slate-100 capitalize truncate">${task.tarea}</h4>
            ${badgeHtml}
          </div>
          <div class="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
            <span>⏱️ Media: <strong class="text-slate-200">${task.minutos || 0} min</strong></span>
            <span>· 🔄 Ejecuciones: <strong class="text-slate-200">${task.ejecuciones || 0}</strong></span>
            <span>· 📅 Próxima: <strong class="text-slate-200">${task.próxima || 'N/D'}</strong></span>
            <span>· 👤 Último: <strong class="text-white">${lastUser}</strong></span>
          </div>
        </div>
        <div>
          ${actionButtonHtml}
        </div>
      `;

      const startBtn = card.querySelector('.btn-task-start');
      if (startBtn) {
        startBtn.addEventListener('click', async () => {
          startBtn.disabled = true;
          startBtn.textContent = '...';
          try {
            const res = await ApiService.startTask(task.id_tarea);
            task.en_progreso_por = res.en_progreso_por || AuthService.getSession().username;
            task.inicio_timestamp = res.inicio_timestamp;
            render();
          } catch (err) {
            alert(err.message);
            await loadInitialData();
          }
        });
      }

      const finishBtn = card.querySelector('.btn-task-finish');
      if (finishBtn) {
        finishBtn.addEventListener('click', async () => {
          finishBtn.disabled = true;
          finishBtn.textContent = '...';
          try {
            const res = await ApiService.finishTask(task.id_tarea);
            task.minutos = res.minutos;
            task.ejecuciones = res.ejecuciones;
            task.en_progreso_por = '';
            task.inicio_timestamp = '';
            render();
          } catch (err) {
            alert(err.message);
            await loadInitialData();
          }
        });
      }

      cardsContainer.appendChild(card);
    });

    container.appendChild(zoneSection);
  });
}
