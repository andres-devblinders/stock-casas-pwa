/**
 * Controlador API REST para la PWA.
 * Gestiona Autenticación (Login + Token) y operaciones sobre el Stock y Precios.
 */

function doGet(e) {
  const token = e.parameter.token;
  if (!isValidToken(token)) {
    return jsonResponse({ status: 'error', code: 401, message: 'No autorizado. Token inválido.' });
  }

  return jsonResponse({
    status: 'ok',
    houses: getHousesConfig(),
    products: getAllProducts()
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // 1. Endpoint público: LOGIN
    if (action === 'LOGIN') {
      return handleLogin(payload.username, payload.password_hash);
    }

    // 2. Middleware de seguridad para el resto de acciones
    if (!isValidToken(payload.token)) {
      return jsonResponse({ status: 'error', code: 401, message: 'Sesión inválida o expirada.' });
    }

    // 3. Enrutador de acciones autenticadas
    switch (action) {
      case 'GET_INITIAL_DATA':
        return jsonResponse({
          status: 'ok',
          houses: getHousesConfig(),
          products: getAllProducts()
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

      default:
        return jsonResponse({ status: 'error', message: `Acción desconocida: ${action}` });
    }
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

/* ==========================================================================
   SERVICIOS DE AUTENTICACIÓN
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
        products: getAllProducts()
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
    if (String(rows[i][2]).trim() === String(token).trim()) {
      return true;
    }
  }
  return false;
}

/* ==========================================================================
   SERVICIOS DE LECTURA Y ESCRITURA DE DATOS
   ========================================================================== */

function getHousesConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configuracion');
  const rows = sheet.getDataRange().getValues();
  const config = {};

  for (let i = 1; i < rows.length; i++) {
    config[rows[i][0]] = rows[i][1];
  }
  return config;
}

function getAllProducts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();

  return rows
    .filter(row => row[0] !== '') // Ignorar filas vacías con fórmula
    .map(row => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      return item;
    });
}

function updateProductStock(productId, houseNumber, newStock) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  const houseColMap = { 1: 4, 2: 5, 3: 6, 4: 7 }; // Columnas D, E, F, G

  const targetCol = houseColMap[Number(houseNumber)];
  if (!targetCol) {
    return jsonResponse({ status: 'error', message: 'Número de casa inválido (1-4).' });
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(productId)) {
      const sanitizedStock = Math.max(0, Number(newStock));
      sheet.getRange(i + 1, targetCol).setValue(sanitizedStock);
      return jsonResponse({ status: 'ok', id_producto: productId, casa: houseNumber, nuevo_stock: sanitizedStock });
    }
  }

  return jsonResponse({ status: 'error', message: 'Producto no encontrado.' });
}

function updateProductPreference(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  const priceColMap = { 'MERCADONA': 16, 'ALIMERKA': 17, 'LIDL': 18, 'ALDI': 19 };

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(payload.id_producto)) {
      // 1. Actualizar supermercado forzado por calidad (vacío = automático por precio)
      if (payload.super_forzado !== undefined) {
        sheet.getRange(i + 1, 20).setValue(payload.super_forzado);
      }
      // 2. Actualizar precio manual si se envía desde el pasillo del supermercado
      if (payload.supermercado && payload.nuevo_precio !== undefined && priceColMap[payload.supermercado]) {
        sheet.getRange(i + 1, priceColMap[payload.supermercado]).setValue(Number(payload.nuevo_precio));
      }

      SpreadsheetApp.flush(); // Forzar recálculo de la fórmula en columna U (super_optimo)
      const superOptimoActualizado = sheet.getRange(i + 1, 21).getValue();

      return jsonResponse({
        status: 'ok',
        id_producto: payload.id_producto,
        super_optimo: superOptimoActualizado
      });
    }
  }

  return jsonResponse({ status: 'error', message: 'Producto no encontrado.' });
}

function createNewProduct(product) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const rows = sheet.getDataRange().getValues();
  
  // Buscar la primera fila cuya columna A esté vacía (para aprovechar la fórmula preinstalada en U)
  let targetRow = rows.length + 1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === '') {
      targetRow = i + 1;
      break;
    }
  }

  const rowValues = [
    product.id_producto || `PROD_${Date.now()}`,
    product.nombre,
    product.categoria || 'General',
    Number(product.stock_casa_1 || 0),
    Number(product.stock_casa_2 || 0),
    Number(product.stock_casa_3 || 0),
    Number(product.stock_casa_4 || 0),
    Number(product.min_casa_1 || 1),
    Number(product.min_casa_2 || 0),
    Number(product.min_casa_3 || 0),
    Number(product.min_casa_4 || 0),
    product.id_mercadona || '',
    '', '', '',
    Number(product.precio_mercadona || 0),
    Number(product.precio_alimerka || 0),
    Number(product.precio_lidl || 0),
    Number(product.precio_aldi || 0),
    product.super_forzado || ''
  ];

  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  
  // Asegurar que la fila tiene la fórmula de super_optimo en la columna U (21)
  const formulaCell = sheet.getRange(targetRow, 21);
  if (!formulaCell.getFormula()) {
    const formula = `=IF(A${targetRow}="","",IF(T${targetRow}<>"",T${targetRow},IF(COUNTIF(P${targetRow}:S${targetRow},">0")=0,"SIN_PRECIO",INDEX({"MERCADONA","ALIMERKA","LIDL","ALDI"},1,MATCH(MINIFS(P${targetRow}:S${targetRow},P${targetRow}:S${targetRow},">0"),P${targetRow}:S${targetRow},0)))))`;
    formulaCell.setFormula(formula);
  }

  SpreadsheetApp.flush();
  return jsonResponse({ status: 'ok', products: getAllProducts() });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}