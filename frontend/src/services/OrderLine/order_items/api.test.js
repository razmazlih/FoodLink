import axios from 'axios';
import { addItemToCart, updateQuantityById, deleteItemFromCart } from './api';

jest.mock('axios', () => ({ post: jest.fn(), put: jest.fn(), delete: jest.fn() }));

test.each([
    ['post', () => addItemToCart({ orderId: 1, menuItemId: 2, quantity: 1, price: 3 })],
    ['put', () => updateQuantityById(2, 4)],
    ['delete', () => deleteItemFromCart(2)],
])('%s failure reaches the cart instead of reporting success', async (method, invoke) => {
    const failure = new Error('offline');
    axios[method].mockRejectedValueOnce(failure);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        await expect(invoke()).rejects.toBe(failure);
    } finally {
        log.mockRestore();
    }
});
