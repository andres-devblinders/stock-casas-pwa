/**
 * Autoinstalador de la Base de Datos en Google Sheets.
 * Ejecuta la función installDatabase() una única vez para inicializar el documento.
 */
function installDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  setupProductosSheet(ss);
  setupConfiguracionSheet(ss);
  setupUsuariosSheet(ss);
  
  // Eliminar la hoja por defecto ("Hoja 1" / "Sheet1") si existe y hay más hojas
  const defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  SpreadsheetApp.flush();
  Logger.log('✅ Base de datos instalada correctamente.');
}

function setupProductosSheet(ss) {
  let sheet = ss.getSheetByName('Productos_y_Stock');
  if (!sheet) {
    sheet = ss.insertSheet('Productos_y_Stock');
  } else {
    sheet.clear();
  }

  const headers = [
    'id_producto', 'nombre', 'categoria',
    'stock_casa_1', 'stock_casa_2', 'stock_casa_3', 'stock_casa_4',
    'min_casa_1', 'min_casa_2', 'min_casa_3', 'min_casa_4',
    'id_mercadona', 'id_alimerka', 'id_lidl', 'id_aldi',
    'precio_mercadona', 'precio_alimerka', 'precio_lidl', 'precio_aldi',
    'super_forzado', 'super_optimo'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight('bold')
       .setBackground('#1e293b')
       .setFontColor('#ffffff');

  // Datos de ejemplo iniciales
  const sampleData = [
    ['LECHE_ENTERA_1L', 'Leche Entera 1L', 'Lácteos', 1, 0, 2, 0, 6, 2, 2, 0, '10382', '', '', '', 0.95, 0.99, 0.93, 0.95, '', ''],
    ['ACEITE_OLIVA_1L', 'Aceite de Oliva Virgen Extra 1L', 'Despensa', 0, 1, 0, 0, 2, 1, 1, 1, '4717', '', '', '', 8.50, 8.20, 8.45, 8.50, 'ALIMERKA', ''],
    ['HUEVOS_L_12', 'Huevos Camperos Docena', 'Frescos', 1, 0, 0, 0, 2, 1, 1, 0, '31504', '', '', '', 2.60, 2.75, 2.55, 2.60, '', '']
  ];

  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);

  // Inyectar fórmula en la columna U (super_optimo) para las primeras 100 filas
  // Lógica: Si T (super_forzado) no está vacío, usa T. Si no, busca el mínimo mayor que 0 entre P, Q, R, S.
  for (let row = 2; row <= 100; row++) {
    const formula = `=IF(A${row}="","",IF(T${row}<>"",T${row},IF(COUNTIF(P${row}:S${row},">0")=0,"SIN_PRECIO",INDEX({"MERCADONA","ALIMERKA","LIDL","ALDI"},1,MATCH(MINIFS(P${row}:S${row},P${row}:S${row},">0"),P${row}:S${row},0)))))`;
    sheet.getRange(row, 21).setFormula(formula);
  }

  sheet.setFrozenRows(1);
}

function setupConfiguracionSheet(ss) {
  let sheet = ss.getSheetByName('Configuracion');
  if (!sheet) {
    sheet = ss.insertSheet('Configuracion');
  } else {
    sheet.clear();
  }

  const headers = ['clave', 'valor', 'descripcion'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight('bold')
       .setBackground('#1e293b')
       .setFontColor('#ffffff');

  const configData = [
    ['NOMBRE_CASA_1', 'Casa 1 (Principal)', 'Nombre visible para la ubicación 1'],
    ['NOMBRE_CASA_2', 'Casa 2', 'Nombre visible para la ubicación 2'],
    ['NOMBRE_CASA_3', 'Casa 3', 'Nombre visible para la ubicación 3'],
    ['NOMBRE_CASA_4', 'Casa 4', 'Nombre visible para la ubicación 4'],
    ['CODIGO_POSTAL', '33001', 'Código postal de referencia para catálogos'],
    ['NOMBRE_SUPER_1', 'MERCADONA', 'Supermercado 1 (fijo - usa API de precios)'],
    ['NOMBRE_SUPER_2', 'ALIMERKA', 'Supermercado 2 (configurable)'],
    ['NOMBRE_SUPER_3', 'LIDL', 'Supermercado 3 (configurable)'],
    ['NOMBRE_SUPER_4', 'ALDI', 'Supermercado 4 (configurable)']
  ];

  sheet.getRange(2, 1, configData.length, configData[0].length).setValues(configData);
  sheet.setFrozenRows(1);
}

function setupUsuariosSheet(ss) {
  let sheet = ss.getSheetByName('Usuarios');
  if (!sheet) {
    sheet = ss.insertSheet('Usuarios');
  } else {
    sheet.clear();
  }

  const headers = ['usuario', 'password_hash', 'token_sesion', 'ultimo_acceso'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight('bold')
       .setBackground('#1e293b')
       .setFontColor('#ffffff');

  // Hash SHA-256 por defecto para el PIN "1234":
  // 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
  const defaultHash = computeSha256('1234');
  const initialToken = Utilities.getUuid();

  sheet.getRange(2, 1, 1, 4).setValues([
    ['admin', defaultHash, initialToken, new Date().toISOString()]
  ]);
  sheet.setFrozenRows(1);
}

/**
 * Función auxiliar para generar hashes SHA-256 desde el propio Excel
 * por si quieres añadir usuarios manualmente.
 */
function computeSha256(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return rawHash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}