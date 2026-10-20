/**
 * AuthService: Gestión de sesión local y cifrado.
 */
export const AuthService = {
    STORAGE_KEY_URL: 'stock_pwa_api_url',
    STORAGE_KEY_TOKEN: 'stock_pwa_session_token',
    STORAGE_KEY_USER: 'stock_pwa_username',

    async hashPassword(plainText) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plainText);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    saveSession(apiUrl, token, username) {
        localStorage.setItem(this.STORAGE_KEY_URL, apiUrl.trim());
        localStorage.setItem(this.STORAGE_KEY_TOKEN, token.trim());
        localStorage.setItem(this.STORAGE_KEY_USER, username.trim());
    },

    getSession() {
        return {
            apiUrl: localStorage.getItem(this.STORAGE_KEY_URL),
            token: localStorage.getItem(this.STORAGE_KEY_TOKEN),
            username: localStorage.getItem(this.STORAGE_KEY_USER)
        };
    },

    isAuthenticated() {
        const session = this.getSession();
        return Boolean(session.apiUrl && session.token);
    },

    logout() {
        localStorage.removeItem(this.STORAGE_KEY_URL);
        localStorage.removeItem(this.STORAGE_KEY_TOKEN);
        localStorage.removeItem(this.STORAGE_KEY_USER);
    }
};