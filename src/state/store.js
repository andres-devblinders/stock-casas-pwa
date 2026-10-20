export const Store = {
    houses: {},
    products: [],
    activeHouse: 1, // Por defecto Casa 1
    listeners: [],

    setState(newState) {
        if (newState.houses) this.houses = newState.houses;
        if (newState.products) this.products = newState.products;
        if (newState.activeHouse) this.activeHouse = newState.activeHouse;
        this.notify();
    },

    subscribe(listener) {
        this.listeners.push(listener);
    },

    notify() {
        this.listeners.forEach(fn => fn(this));
    },

    // Obtiene los productos que necesitan compra para la casa activa (o todas)
    getShoppingList(houseNumber = null) {
        return this.products.filter(p => {
            if (houseNumber) {
                const stock = Number(p[`stock_casa_${houseNumber}`] || 0);
                const min = Number(p[`min_casa_${houseNumber}`] || 0);
                return stock < min;
            }
            // Si no se especifica casa, revisa las 4 viviendas
            for (let h = 1; h <= 4; h++) {
                if (Number(p[`stock_casa_${h}`] || 0) < Number(p[`min_casa_${h}`] || 0)) {
                    return true;
                }
            }
            return false;
        });
    }
};