export const Store = {
  houses: {},
  products: [],
  tasks: [],
  users: [],
  activeHouse: 1,

  setState(newState) {
    if (newState.houses !== undefined) this.houses = newState.houses;
    if (newState.products !== undefined) this.products = newState.products;
    if (newState.tasks !== undefined) this.tasks = newState.tasks;
    if (newState.users !== undefined) this.users = newState.users;
    if (newState.activeHouse !== undefined) this.activeHouse = newState.activeHouse;
  },

  getShoppingList() {
    return this.products.filter(prod => {
      for (let i = 1; i <= 4; i++) {
        const stock = Number(prod[`stock_casa_${i}`] || 0);
        const min = Number(prod[`min_casa_${i}`] || 0);
        if (stock < min) return true;
      }
      return false;
    });
  }
};
