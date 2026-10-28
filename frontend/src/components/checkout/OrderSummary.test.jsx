import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import OrderSummary from './OrderSummary';
import { CartContext } from '../../context/CartContext';
import { saveDeliveryAddress } from '../../services/OrderLine/order/api';
import { updateCartStatus } from '../../services/OrderLine/status/api';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ orderId: '12' }) }), { virtual: true });
jest.mock('react-i18next', () => { const t = key => key; return { useTranslation: () => ({ t }) }; });
jest.mock('../../services/OrderLine/order/api', () => ({ saveDeliveryAddress: jest.fn() }));
jest.mock('../../services/OrderLine/status/api', () => ({ updateCartStatus: jest.fn() }));
const address = { id: 'home', label: 'Home', city: 'Haifa', street_name: 'Main', house_number: 1, is_default: true };
let host, root, updateCart;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); host = document.createElement('div'); root = createRoot(host); updateCart = jest.fn(); });
afterEach(async () => { await act(async () => root.unmount()); });
const render = async deliveryAddress => { await act(async () => root.render(<CartContext.Provider value={{ updateCart }}><OrderSummary totalPrice={25} myOrder={{ id: 12, items: [], restaurantId: 3 }} deliveryAddress={deliveryAddress} /></CartContext.Provider>)); };

test('checkout cannot activate an order without a destination', async () => {
    await render(null);
    expect(host.querySelector('.order-checkout-button-checkout').disabled).toBe(true);
    expect(host.textContent).toContain('chooseDeliveryAddress');
    expect(updateCartStatus).not.toHaveBeenCalled();
});

test('checkout waits for the address snapshot before activation and clearing the cart', async () => {
    let complete;
    saveDeliveryAddress.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    updateCartStatus.mockResolvedValue({});
    await render(address);
    await act(async () => host.querySelector('.order-checkout-button-checkout').click());
    expect(saveDeliveryAddress).toHaveBeenCalledWith('12', { label: 'Home', city: 'Haifa', street_name: 'Main', house_number: 1 });
    expect(updateCartStatus).not.toHaveBeenCalled();
    expect(host.querySelector('.order-checkout-button-checkout').disabled).toBe(true);
    await act(async () => complete({}));
    expect(updateCartStatus).toHaveBeenCalledWith('12', 'active');
    expect(updateCart).toHaveBeenCalledWith([], '');
    expect(mockNavigate).toHaveBeenCalledWith('/my-orders');
});

test('snapshot failure preserves cart and never activates the order', async () => {
    saveDeliveryAddress.mockRejectedValue(new Error('offline'));
    await render(address);
    await act(async () => host.querySelector('.order-checkout-button-checkout').click());
    expect(updateCartStatus).not.toHaveBeenCalled();
    expect(updateCart).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(host.querySelector('[role=alert]').textContent).toBe('checkoutError');
    expect(host.querySelector('.order-checkout-button-checkout').disabled).toBe(false);
});
