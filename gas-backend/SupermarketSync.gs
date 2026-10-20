/**
 * Sincronizador de precios con Supermercados (Patrón Adapter).
 * Conecta actualmente con la API de Mercadona y deja la arquitectura abierta
 * para Alimerka, Lidl y Aldi.
 */

const SupermarketAdapters = {
  MERCADONA: function(productId) {
    if (!productId) return null;
    try {
      const url = `https://tienda.mercadona.es/api/products/${encodeURIComponent(String(productId).trim())}/`;
      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: { 'Accept': 'application/json' },
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        if (json && json.price_instructions && json.price_instructions.unit_price) {
          return parseFloat(json.price_instructions.unit_price);
        }
      }
    } catch (error) {
      Logger.log(`Error sincronizando Mercadona ID ${productId}: ${error}`);
    }
    return null;
  },

  ALIMERKA: function(productId) {
    // Preparado para futura integración (API / Scraping)
    return null;
  },

  LIDL: function(productId) {
    // Preparado para futura integración (API / Scraping)
    return null;
  },

  ALDI: function(productId) {
    // Preparado para futura integración (API / Scraping)
    return null;
  }
};

/**
 * Recorre todos los productos de la hoja y actualiza sus precios en bloque.
 * Se puede ejecutar mediante un Trigger semanal o bajo demanda desde la WebApp.
 */
function syncAllPrices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos_y_Stock');
  const data = sheet.getDataRange().getValues();
  let updatedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const productId = data[i][0];
    if (!productId) continue;

    // 1. Mercadona (Columna L = índice 11 -> Precio en Columna P = 16)
    const idMercadona = data[i][11];
    if (idMercadona) {
      const priceMercadona = SupermarketAdapters.MERCADONA(idMercadona);
      if (priceMercadona !== null && priceMercadona > 0) {
        sheet.getRange(i + 1, 16).setValue(priceMercadona);
        updatedCount++;
      }
      Utilities.sleep(150); // Pausa breve de cortesía para la API
    }

    // 2. Futuros conectores (Alimerka: Col M->Q, Lidl: Col N->R, Aldi: Col O->S)
  }

  SpreadsheetApp.flush();
  Logger.log(`Sincronización finalizada. Precios actualizados: ${updatedCount}`);
  return updatedCount;
}