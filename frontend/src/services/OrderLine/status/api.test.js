import axios from 'axios';
import { updateCartStatus } from './api';
jest.mock('axios', () => ({ post: jest.fn() }));
test('failed submission rejects so checkout cannot clear the cart or show success', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        axios.post.mockRejectedValueOnce(new Error('denied'));
        await expect(updateCartStatus(3, 'active')).rejects.toThrow('denied');
    } finally { log.mockRestore(); }
});
