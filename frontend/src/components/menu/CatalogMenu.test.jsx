import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import MenuItem from './MenuItem';
import RestaurantInfo from './RestaurantInfo';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, values) => values ? `${key} ${values.date}` : key }) }));
jest.mock('../../context/AuthContext', () => ({ AuthContext: require('react').createContext({}) }));
jest.mock('../../context/CartContext', () => ({ CartContext: require('react').createContext({}) }));

let host, root;
beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

test.each([null, 'signed-in-user'])('unavailable source items cannot be ordered by user %s', async (userId) => {
    const addToCart = jest.fn();
    await act(async () => root.render(
        <AuthContext.Provider value={{ userId }}>
            <CartContext.Provider value={{ addToCart, checkInCart: () => false, cart: [] }}>
                <MenuItem menuItem={{ id: 1, name: 'Dish', price: '32.00', is_available: false }} />
            </CartContext.Provider>
        </AuthContext.Provider>
    ));
    const button = host.querySelector('button');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('menuItemUnavailable');
    await act(async () => button.click());
    expect(addToCart).not.toHaveBeenCalled();
});

test('catalog menu exposes its source, verification date and reference-only status', async () => {
    await act(async () => root.render(<RestaurantInfo restaurant={{ name: 'Restaurant', city: 'City', address: 'Street 1', source_url: 'https://example.com/menu', verified_on: '2026-10-28', price_context: 'Published dine-in menu prices', catalog_only: true }} />));
    expect(host.querySelector('a').href).toBe('https://example.com/menu');
    expect(host.textContent).toContain('2026-10-28');
    expect(host.textContent).toContain('Published dine-in menu prices');
    expect(host.textContent).toContain('catalogOnlyNotice');
});
