import axios from 'axios';
import { getAccessToken } from '../firebase';
import { fetchManagerOrders, fetchManagerOrder, fetchDashboardStats } from './api';
jest.mock('../firebase', () => ({ getAccessToken: jest.fn() }));
jest.mock('axios', () => ({ create: jest.fn(() => ({ get: jest.fn(), interceptors: { request: { use: jest.fn() } } })) }));
const [users, , orders] = axios.create.mock.results.map((result) => result.value);
const tokenIntercept = users.interceptors.request.use.mock.calls[0][0];
test('uses actual backend endpoints and adapts order fields', async () => {
  const order = { id: 4, user_id: 'uid', restaurant_id: 2, total_price: 25, status: [{ status: 'active' }] };
  orders.get.mockResolvedValueOnce({ data: [order] }).mockResolvedValueOnce({ data: order });
  users.get.mockResolvedValue({ data: { totalOrders: 1 } });
  expect((await fetchManagerOrders()).data[0]).toMatchObject({ user: 'uid', restaurant: 2, total: 25, status: 'active' });
  expect((await fetchManagerOrder(4)).data.id).toBe(4);
  expect((await fetchDashboardStats()).data.totalOrders).toBe(1);
  expect(orders.get.mock.calls).toEqual([['/orders/?all=true'], ['/orders/4/']]); expect(users.get).toHaveBeenCalledWith('/stats/');
});
test('fetches a fresh Firebase token for each request', async () => {
  const intercept = tokenIntercept;
  getAccessToken.mockResolvedValueOnce('one').mockResolvedValueOnce('two');
  expect((await intercept({ headers: {} })).headers.Authorization).toBe('Bearer one');
  expect((await intercept({ headers: {} })).headers.Authorization).toBe('Bearer two');
});
