/**
 * Controlador API REST para la PWA.
 * Gestiona Autenticación (Login + Token), Stock, Precios y Tareas.
 */

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
        if (currentOwner && currentOwner !== username) {
          return { status: 'error', message: 'La tarea ya está en progreso por otro usuario.' };
        }
        const now = Date.now();
        sheet.getRange(i + 1, 8).setValue(username);
        sheet.getRange(i + 1, 9).setValue(now);
        return { status: 'ok', id_tarea: taskId, en_progreso_por: username, inicio_timestamp: now };
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
        const currentOwner = String(data[i][7] || '').trim();
        if (currentOwner !== username) {
          return { status: 'error', message: 'No puedes finalizar una tarea que no has iniciado.' };
        }

        const startTime = Number(data[i][8] || Date.now());
        const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));

        const prevMinutos = Number(data[i][2] || 0);
        const prevEjecuciones = Number(data[i][5] || 0);

        const nuevasEjecuciones = prevEjecuciones + 1;
        const nuevosMinutos = prevEjecuciones === 0
          ? elapsedMinutes
          : Math.round((((prevMinutos * prevEjecuciones) + elapsedMinutes) / nuevasEjecuciones) * 10) / 10;

        sheet.getRange(i + 1, 3).setValue(nuevosMinutos);
        sheet.getRange(i + 1, 6).setValue(nuevasEjecuciones);
        sheet.getRange(i + 1, 8).setValue('');
        sheet.getRange(i + 1, 9).setValue('');

        return {
          status: 'ok',
          id_tarea: taskId,
          minutos: nuevosMinutos,
          ejecuciones: nuevasEjecuciones,
          duracion_ultima: elapsedMinutes
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
   SERVICIOS DE AUTENTICACIÓN Y DATOS EXISTENTES
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
