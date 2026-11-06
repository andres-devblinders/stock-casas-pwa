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
  if (!Store.tasks || !Store.tasks.length) {
    container.innerHTML = '<div class="text-center text-slate-400 py-8">No hay tareas registradas en la hoja Tareas.</div>';
    return;
  }

  const session = AuthService.getSession();
  const currentUser = String(session.username || '').trim().toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Procesar cada tarea y calcular su diferencia de días y prioridad estricta por vencimiento
  const processedTasks = Store.tasks.map(task => {
    const rawOwner = String(task.en_progreso_por || '').trim();
    const timestamp = Number(task.inicio_timestamp || 0);

    const isProgress = Boolean((rawOwner && timestamp > 0) || task._justStartedByMe);
    const isMine = isProgress && (rawOwner.toLowerCase() === currentUser || Boolean(task._justStartedByMe));
    const lastUser = (!isProgress && rawOwner) ? rawOwner : 'Nadie';

    let diffDays = 0;
    let formattedDate = 'N/D';
    if (task.próxima) {
      const datePart = String(task.próxima).split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      } else {
        formattedDate = datePart;
      }

      const taskDate = new Date(datePart);
      const todayDate = new Date(todayStr);
      diffDays = Math.round((taskDate - todayDate) / (1000 * 60 * 60 * 24));
    }

    // Prioridades: 1: En curso, 2: Vencidas, 3: Hoy, 4: Futuras
    let priority = 4;
    let subSort = diffDays;

    if (isProgress) {
      priority = 1;
    } else if (diffDays < 0) {
      priority = 2;
      subSort = diffDays;
    } else if (diffDays === 0) {
      priority = 3;
    } else {
      priority = 4;
      subSort = diffDays;
    }

    return {
      ...task,
      rawOwner,
      isProgress,
      isMine,
      lastUser,
      diffDays,
      formattedDate,
      priority,
      subSort,
      zona: String(task.zona || 'General').trim()
    };
  });

  // 2. Ordenar globalmente por prioridad y estado de vencimiento
  processedTasks.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (a.priority === 2) {
      return a.subSort - b.subSort;
    }
    if (a.priority === 4) {
      return a.subSort - b.subSort;
    }
    return String(a.tarea).localeCompare(String(b.tarea));
  });

  container.innerHTML = '';
  const listWrapper = document.createElement('div');
  listWrapper.className = 'space-y-2';

  processedTasks.forEach(task => {
    let actionButtonHtml = '';

    if (task.isProgress && (task.isMine || task._justStartedByMe)) {
      actionButtonHtml = `
        <button class="btn-task-finish bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition whitespace-nowrap animate-pulse">
          Finalizar
        </button>
      `;
    } else if (task.isProgress && !task.isMine) {
      actionButtonHtml = `
        <button disabled class="bg-slate-700 text-slate-400 text-[11px] font-medium px-2.5 py-1.5 rounded-lg cursor-not-allowed whitespace-nowrap border border-slate-600">
          En curso (${task.rawOwner})
        </button>
      `;
    } else {
      actionButtonHtml = `
        <button class="btn-task-start bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition whitespace-nowrap">
          Iniciar
        </button>
      `;
    }

    let cardBgColor = 'bg-slate-800 border-slate-700';
    let badgeHtml = '';

    if (task.isProgress) {
      cardBgColor = 'bg-amber-950/40 border-amber-600/50';
      badgeHtml = `<span class="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">En curso</span>`;
    } else if (task.diffDays < 0) {
      cardBgColor = 'bg-rose-950/40 border-rose-600/50';
      badgeHtml = `<span class="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">Vencida (${Math.abs(task.diffDays)}d)</span>`;
    } else if (task.diffDays === 0) {
      cardBgColor = 'bg-emerald-950/40 border-emerald-600/50';
      badgeHtml = `<span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">Toca hoy</span>`;
    } else {
      cardBgColor = 'bg-slate-800 border-slate-700';
      badgeHtml = `<span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">En ${task.diffDays}d</span>`;
    }

    const card = document.createElement('div');
    card.className = `${cardBgColor} p-3 rounded-xl border flex justify-between items-center gap-2 transition-colors`;

    card.innerHTML = `
      <div class="space-y-1 overflow-hidden">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="font-semibold text-sm text-slate-100 capitalize truncate">${task.tarea}</h4>
          ${badgeHtml}
        </div>
        <div class="text-[11px] text-slate-300 flex flex-wrap gap-x-2 gap-y-0.5">
          <span>📍 <strong class="text-white">${task.zona}</strong></span>
          <span>· ⏱️ Media: <strong class="text-white">${task.minutos || 0} min</strong></span>
          <span>· 📅 Próx: <strong class="text-white">${task.formattedDate}</strong></span>
          <span>· 👤 Último: <strong class="text-white">${task.lastUser}</strong></span>
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
        startBtn.textContent = 'Iniciando...';
        try {
          const res = await ApiService.startTask(task.id_tarea);

          const originalTask = Store.tasks.find(t => String(t.id_tarea) === String(task.id_tarea));
          if (originalTask) {
            const ownerName = String(res.en_progreso_por || session.username || 'admin').trim();
            localStorage.setItem(AuthService.STORAGE_KEY_USER, ownerName);
            document.getElementById('header-user').textContent = `Usuario: ${ownerName}`;

            originalTask.en_progreso_por = ownerName;
            originalTask.inicio_timestamp = Number(res.inicio_timestamp || Date.now());
            originalTask._justStartedByMe = true;
          }

          render();
        } catch (err) {
          alert('Error al iniciar: ' + err.message);
          startBtn.disabled = false;
          startBtn.textContent = 'Iniciar';
        }
      });
    }

    const finishBtn = card.querySelector('.btn-task-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', async () => {
        finishBtn.disabled = true;
        finishBtn.textContent = 'Guardando...';
        try {
          const res = await ApiService.finishTask(task.id_tarea);

          const originalTask = Store.tasks.find(t => String(t.id_tarea) === String(task.id_tarea));
          if (originalTask) {
            originalTask.minutos = res.minutos;
            originalTask.ejecuciones = res.ejecuciones;
            originalTask.próxima = res.próxima;
            originalTask.en_progreso_por = res.ultimo_usuario || session.username;
            originalTask.inicio_timestamp = '';
            delete originalTask._justStartedByMe;
          }

          render();
        } catch (err) {
          alert('Error al finalizar: ' + err.message);
          finishBtn.disabled = false;
          finishBtn.textContent = 'Finalizar';
        }
      });
    }

    listWrapper.appendChild(card);
  });

  container.appendChild(listWrapper);
}
```[cite: 5, 13]

**`gas-backend/ApiController.gs`**

```javascript
/**
 * Controlador API REST para la PWA.
 * Gestiona Autenticación (Login + Token), Stock, Precios y Tareas.
 */

function doGet(e) {
  const token = e && e.parameter ? e.parameter.token : null;
  if (!isValidToken(token)) {
    return jsonResponse({ status: 'error', code: 401, message: 'No autorizado. Token inválido.' });
  }

  return jsonResponse({
    status: 'ok',
    houses: getHousesConfig(),
    products: getAllProducts(),
    tasks: getTasksData()
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'LOGIN') {
      return handleLogin(payload.username, payload.password_hash);
    }

    if (!isValidToken(payload.token)) {
      return jsonResponse({ status: 'error', code: 401, message: 'Sesión inválida o expirada.' });
    }

    switch (action) {
      case 'GET_INITIAL_DATA':
        return jsonResponse({
          status: 'ok',
          houses: getHousesConfig(),
          products: getAllProducts(),
          tasks: getTasksData()
        });

      case 'UPDATE_STOCK':
        return updateProductStock(payload.id_producto, payload.casa, payload.nuevo_stock);

      case 'UPDATE_PREFERENCE':
        return updateProductPreference(payload);

      case 'CREATE_PRODUCT':
        return createNewProduct(payload.product);

      case 'SYNC_MERCADONA':
        const updatedCount = syncAllPrices();
        return jsonResponse({ status: 'ok', updated: updatedCount, products: getAllProducts() });

      case 'START_TASK':
        return jsonResponse(startTask(payload.id_tarea, getUsernameByToken(payload.token)));

      case 'FINISH_TASK':
        return jsonResponse(finishTask(payload.id_tarea, getUsernameByToken(payload.token)));

      default:
        return jsonResponse({ status: 'error', message: `Acción desconocida: ${action}` });
    }
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

/* ==========================================================================
   SERVICIOS DE TAREAS
   ========================================================================== */

function getTasksData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim());

  return rows.slice(1).filter(r => r[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function startTask(taskId, username) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
    const data = sheet.getDataRange().getValues();

    if (!data[0][7]) sheet.getRange(1, 8).setValue('en_progreso_por');
    if (!data[0][8]) sheet.getRange(1, 9).setValue('inicio_timestamp');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(taskId)) {
        const currentOwner = String(data[i][7] || '').trim();
        const currentTs = Number(data[i][8] || 0);

        if (currentOwner && currentTs > 0 && currentOwner.toLowerCase() !== String(username).toLowerCase()) {
          return { status: 'error', message: 'La tarea ya está en progreso por otro usuario.' };
        }

        const now = Date.now();
        sheet.getRange(i + 1, 8).setValue(username);
        sheet.getRange(i + 1, 9).setValue(now);
        SpreadsheetApp.flush();

        return {
          status: 'ok',
          id_tarea: taskId,
          en_progreso_por: username,
          inicio_timestamp: now
        };
      }
    }
    return { status: 'error', message: 'Tarea no encontrada.' };
  } finally {
    lock.releaseLock();
  }
}

function finishTask(taskId, username) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tareas');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(taskId)) {
        const startTime = Number(data[i][8] || Date.now());
        const exactElapsedMinutes = (Date.now() - startTime) / 60000;

        const prevMinutos = Number(String(data[i][2] || 0).replace(',', '.'));
        const prevEjecuciones = Number(data[i][5] || 0);
        const nuevasEjecuciones = prevEjecuciones + 1;

        let nuevosMinutos;
        if (exactElapsedMinutes < 1) {
          nuevosMinutos = prevMinutos > 0 ? prevMinutos : 1;
        } else {
          const elapsedRounded = Math.round(exactElapsedMinutes);
          nuevosMinutos = prevEjecuciones === 0
            ? (prevMinutos > 0 ? Math.round(((prevMinutos + elapsedRounded) / 2) * 10) / 10 : elapsedRounded)
            : Math.round((((prevMinutos * prevEjecuciones) + elapsedRounded) / nuevasEjecuciones) * 10) / 10;
        }

        const frecuenciaDias = Number(data[i][3] || 1);
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + frecuenciaDias);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        sheet.getRange(i + 1, 3).setValue(nuevosMinutos);
        sheet.getRange(i + 1, 6).setValue(nuevasEjecuciones);
        sheet.getRange(i + 1, 7).setValue(nextDateStr);
        sheet.getRange(i + 1, 8).setValue(username);
        sheet.getRange(i + 1, 9).setValue('');
        SpreadsheetApp.flush();

        return {
          status: 'ok',
          id_tarea: taskId,
          minutos: nuevosMinutos,
          ejecuciones: nuevasEjecuciones,
          próxima: nextDateStr,
          ultimo_usuario: username
        };
      }
    }
    return { status: 'error', message: 'Tarea no encontrada.' };
  } finally {
    lock.releaseLock();
  }
}

function getUsernameByToken(token) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === token) return rows[i][0];
  }
  return 'admin';
}

/* ==========================================================================
   SERVICIOS DE AUTENTICACIÓN Y DATOS
   ========================================================================== */

function handleLogin(username, passwordHash) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const dbUser = String(rows[i][0]).trim().toLowerCase();
    const dbHash = String(rows[i][1]).trim().toLowerCase();

    if (dbUser === String(username).trim().toLowerCase() && dbHash === String(passwordHash).trim().toLowerCase()) {
      let token = rows[i][2];
      if (!token) {
        token = Utilities.getUuid();
        sheet.getRange(i + 1, 3).setValue(token);
      }
      sheet.getRange(i + 1, 4).setValue(new Date().toISOString());

      return jsonResponse({
        status: 'ok',
        token: token,
        username: rows[i][0],
        houses: getHousesConfig(),
        products: getAllProducts(),
        tasks: getTasksData()
      });
    }
  }

  return jsonResponse({ status: 'error', code: 401, message: 'Usuario o contraseña incorrectos.' });
}

function isValidToken(token) {
  if (!token) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === token) return true;
  }
  return false;
}

function getHousesConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configuracion');
  const rows = sheet.getDataRange().getValues();
  const houses = {};
  for (let i = 1; i < rows.length; i++) {
    houses[rows[i][0]] = rows[i][1];
  }
  return houses;
}

function getAllProducts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = row[index];
    });
    return obj;
  });
}

function updateProductStock(productId, houseNumber, newStock) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const colName = `stock_casa_${houseNumber}`;
  const colIndex = headers.indexOf(colName);

  if (colIndex === -1) return jsonResponse({ status: 'error', message: 'Columna de casa no encontrada' });

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(productId)) {
      sheet.getRange(i + 1, colIndex + 1).setValue(newStock);
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Producto no encontrado' });
}

function updateProductPreference(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const colIndex = headers.indexOf('super_forzado');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(payload.id_producto)) {
      sheet.getRange(i + 1, colIndex + 1).setValue(payload.super_forzado);
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Producto no encontrado' });
}

function createNewProduct(product) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  sheet.appendRow([
    product.id_producto, product.nombre, product.categoria,
    product.stock_casa_1 || 0, product.stock_casa_2 || 0, product.stock_casa_3 || 0, product.stock_casa_4 || 0,
    product.min_casa_1 || 0, product.min_casa_2 || 0, product.min_casa_3 || 0, product.min_casa_4 || 0,
    '', '', '', '', '', '', '', '', '', ''
  ]);
  return jsonResponse({ status: 'ok' });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
