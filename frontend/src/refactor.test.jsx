import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { CartContext, CartContextProvider } from './context/CartContext';
import { AuthContext } from './context/AuthContext';
import Orders from './components/orders/Orders';
import CartTemplate from './components/cart/CartTemplate';
import OrderDetailsMain from './components/order-detail/OrderDetailsMain';
import OrderCheckoutMain from './components/checkout/OrderCheckoutMain';
import { fetchOrder, fetchAllOrders } from './services/OrderLine/order/api';
import { addItemToCart, updateQuantityById, deleteItemFromCart } from './services/OrderLine/order_items/api';
import { getRestaurantsNamesAndIds } from './services/DishBoard/restaurants/api';
import { getMenuItemNameById } from './services/DishBoard/menu/api';
import { resolveMenuItemNames } from './services/DishBoard/menu/names';
import socket from './services/OrderLine/status/websocket';
import { fetchProfile } from './services/Userbase/api';

jest.mock('react-router-dom', () => ({ Link: ({ children }) => <span>{children}</span>, useNavigate: () => jest.fn(), useParams: () => ({ orderId: '12' }) }), { virtual: true });
jest.mock('react-i18next', () => {
    const t = (key) => key;
    return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
});
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('./services/OrderLine/order/api');
jest.mock('./services/Userbase/api', () => ({ fetchProfile: jest.fn().mockResolvedValue({ addresses: [] }), saveAddresses: jest.fn() }));
jest.mock('./services/OrderLine/order_items/api');
jest.mock('./services/DishBoard/restaurants/api');
jest.mock('./services/DishBoard/menu/api');
jest.mock('./services/OrderLine/status/websocket', () => ({ connect: jest.fn(), disconnect: jest.fn() }));
jest.mock('./components/orders/SingleOrder', () => () => null);

let root, host;
beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    jest.clearAllMocks();
    fetchProfile.mockResolvedValue({ addresses: [] });
    host = document.createElement('div');
    root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

async function render(element) { await act(async () => root.render(element)); }

test('cart decrement makes one mutation and removal deletes the final item', async () => {
    localStorage.setItem('cartItems', JSON.stringify([{ id: 4, quantity: 2 }]));
    let context;
    function Probe() { context = useContext(CartContext); return null; }
    await render(<CartContextProvider><Probe /></CartContextProvider>);
    await act(async () => context.removeFromCart(context.cart[0]));
    expect(updateQuantityById).toHaveBeenCalledTimes(1);
    expect(updateQuantityById).toHaveBeenCalledWith(4, 1);
    expect(context.cart[0].quantity).toBe(1);
    expect(JSON.parse(localStorage.getItem('cartItems'))[0].quantity).toBe(1);
    await act(async () => context.removeFromCart(context.cart[0]));
    expect(deleteItemFromCart).toHaveBeenCalledWith(4);
    expect(context.cart).toEqual([]);
});

test('failed cart mutation leaves local cart intact', async () => {
    localStorage.setItem('cartItems', JSON.stringify([{ id: 4, quantity: 2 }]));
    updateQuantityById.mockRejectedValueOnce(new Error('offline'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    let context;
    function Probe() { context = useContext(CartContext); return null; }
    await render(<CartContextProvider><Probe /></CartContextProvider>);
    await act(async () => context.removeFromCart(context.cart[0]));
    expect(context.cart[0].quantity).toBe(2);
    expect(JSON.parse(localStorage.getItem('cartItems'))[0].quantity).toBe(2);
    errorLog.mockRestore();
});

test('orders share one response and restaurant names do not reload on cart changes', async () => {
    const response = [{ id: 2, status: [] }, { id: 1, status: [] }];
    fetchAllOrders.mockResolvedValue(response);
    getRestaurantsNamesAndIds.mockResolvedValue([{ id: 3, name: 'Cafe' }]);
    const view = (cart) => <AuthContext.Provider value={{ userId: '7' }}><CartContext.Provider value={{ cart }}><Orders /></CartContext.Provider></AuthContext.Provider>;
    await render(view([]));
    expect(fetchAllOrders).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('myReservations'))).toEqual(response);
    expect(response.map(({ id }) => id)).toEqual([2, 1]);
    expect(JSON.parse(localStorage.getItem('myOrders')).map(({ id }) => id)).toEqual([1, 2]);
    await render(view([{ id: 2 }]));
    expect(fetchAllOrders).toHaveBeenCalledTimes(2);
    expect(getRestaurantsNamesAndIds).toHaveBeenCalledTimes(1);
});

test('menu names deduplicate concurrent requests and retain existing storage entries', async () => {
    localStorage.setItem('cartNames', JSON.stringify({ 9: 'Existing' }));
    getMenuItemNameById.mockResolvedValue('Soup');
    const items = [{ menu_item_id: 3 }, { menu_item_id: 3 }, { menu_item_id: 9 }, { menu_item_id: 8, name: 'Provided' }];
    const [names] = await Promise.all([resolveMenuItemNames(items), resolveMenuItemNames(items)]);
    expect(names).toEqual({ 3: 'Soup', 9: 'Existing', 8: 'Provided' });
    expect(getMenuItemNameById).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('cartNames'))).toEqual({ 3: 'Soup', 9: 'Existing' });
});

test('plain websocket updates reload the current order status and timestamp', async () => {
    fetchOrder.mockResolvedValueOnce({ items: [], status: [{ status: 'active', updated_at: '2026-10-27T10:00:00Z' }] });
    await render(<OrderDetailsMain />);
    expect(host.textContent).toContain('active');
    fetchOrder.mockResolvedValueOnce({ items: [], status: [{ status: 'delivered', updated_at: '2026-10-27T11:00:00Z' }] });
    await act(async () => socket.connect.mock.calls[0][1]('unrelated-status'));
    expect(fetchOrder).toHaveBeenLastCalledWith('12');
    expect(host.textContent).toContain('delivered');
    expect(host.textContent).toContain(new Date('2026-10-27T11:00:00Z').toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' }));
    expect(host.textContent).not.toContain('unrelated-status');
    expect(host.textContent).not.toContain('Invalid Date');
});


test('order-detail cleanup disconnects and ignores stale request completion', async () => {
    let complete;
    fetchOrder.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    await render(<OrderDetailsMain />);
    const disconnects = socket.disconnect.mock.calls.length;
    await render(<div>Other page</div>);
    expect(socket.disconnect).toHaveBeenCalledTimes(disconnects + 1);
    await act(async () => complete({ items: [{ menu_item_id: 72 }], status: [{ status: 'delivered', updated_at: '2026-10-27T11:00:00Z' }] }));
    expect(host.textContent).toBe('Other page');
    expect(getMenuItemNameById).not.toHaveBeenCalled();
});


test('cart increment handles offline rejection without changing the displayed quantity', async () => {
    localStorage.setItem('cartNames', JSON.stringify({ 3: 'Soup' }));
    const updateQuantity = jest.fn().mockRejectedValue(new Error('offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        await render(<CartContext.Provider value={{ updateQuantity }}><CartTemplate item={{ id: 4, menu_item_id: 3, quantity: 2, price: 10 }} /></CartContext.Provider>);
        const increment = [...host.querySelectorAll('button')].find((button) => button.textContent.trim() === '+');
        await act(async () => increment.click());
        expect(updateQuantity).toHaveBeenCalledWith(4, 3);
        expect(host.textContent).toContain('x 2');
        expect(log).toHaveBeenCalledWith('Error increasing cart quantity:', expect.any(Error));
    } finally {
        log.mockRestore();
    }
});


test('cart uses the server price rather than the submitted menu price', async () => {
    addItemToCart.mockResolvedValueOnce({ id: 8, order_id: 2, menu_item_id: 3, quantity: 1, price: 25, name: 'Server name' });
    let context;
    function Probe() { context = useContext(CartContext); return null; }
    await render(<CartContextProvider><Probe /></CartContextProvider>);
    await act(async () => context.addToCart({ id: 3, name: 'Old name', price: 999 }));
    expect(context.cart[0]).toMatchObject({ price: 25, name: 'Server name' });
});


test('continuing checkout preserves the server item name when item IDs differ from menu IDs', async () => {
    const updateCart = jest.fn();
    fetchOrder.mockResolvedValueOnce({ id: 12, restaurant_id: 3, total_price: 25, ordered_at: '2026-10-27T10:00:00Z', items: [{ id: 99, menu_item_id: 3, name: 'Snapshot dish', price: 25, quantity: 1 }] });
    await render(<AuthContext.Provider value={{ userId: '7' }}><CartContext.Provider value={{ cart: [], updateCart }}><OrderCheckoutMain /></CartContext.Provider></AuthContext.Provider>);
    await act(async () => host.querySelector('.order-checkout-button-continue').click());
    expect(updateCart).toHaveBeenCalledWith([expect.objectContaining({ id: 99, name: 'Snapshot dish' })], 12);
});
