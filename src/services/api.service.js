import { AuthService } from './auth.service.js';

export const ApiService = {
  async request(action, payload = {}) {
    const session = AuthService.getSession();
    const url = payload.apiUrl || session.apiUrl;

    if (!url) {
      throw new Error('No se ha configurado la URL de la API.');
    }

    const body = {
      action,
      token: session.token,
      ...payload
    };

    const response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store', // 👈 Forzar que nunca use caché en las peticiones de red
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
      if (data.code === 401) {
        AuthService.logout();
        window.location.reload();
      }
      throw new Error(data.message || 'Error en la petición.');
    }

    return data;
  },

  async login(apiUrl, username, plainPassword) {
    const passwordHash = await AuthService.hashPassword(plainPassword);
    const data = await this.request('LOGIN', {
      apiUrl,
      username,
      password_hash: passwordHash
    });

    AuthService.saveSession(apiUrl, data.token, data.username);
    return data;
  },

  async getInitialData() {
    return this.request('GET_INITIAL_DATA');
  },

  async updateStock(productId, houseNumber, newStock) {
    return this.request('UPDATE_STOCK', {
      id_producto: productId,
      casa: houseNumber,
      nuevo_stock: newStock
    });
  },

  async updatePreference(productId, supermarket, price) {
    return this.request('UPDATE_PREFERENCE', {
      id_producto: productId,
      super_forzado: supermarket,
      nuevo_precio: price
    });
  },

  async startTask(taskId) {
    return this.request('START_TASK', {
      id_tarea: taskId
    });
  },

  async finishTask(taskId) {
    return this.request('FINISH_TASK', {
      id_tarea: taskId
    });
  }
};
