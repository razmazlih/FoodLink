import axios from 'axios';
import { getAccessToken } from '../firebase';

const createClient = (baseURL) => {
  const client = axios.create({ baseURL });
  client.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return client;
};

const usersBase = process.env.REACT_APP_USER_BASE_URL || 'http://localhost:8001/api';
export const userApi = createClient(`${usersBase.replace(/\/$/, '')}/admin`);
export const dashboardApi = createClient(process.env.REACT_APP_DISH_BOARD_URL || 'http://localhost:8002/api');
const orderApi = createClient(process.env.REACT_APP_ORDER_LINE_URL || 'http://localhost:8003');

const managerOrder = (order) => ({
  ...order,
  user: order.user_id,
  restaurant: order.restaurant_id,
  total: order.total_price,
  status: order.status?.[order.status.length - 1]?.status || 'draft',
});
export const fetchManagerOrders = async () => {
  const response = await orderApi.get('/orders/?all=true');
  return { ...response, data: response.data.map(managerOrder) };
};
export const fetchManagerOrder = async (id) => {
  const response = await orderApi.get(`/orders/${id}/`);
  return { ...response, data: managerOrder(response.data) };
};
export const fetchDashboardStats = () => userApi.get('/stats/');

export const setManagerOrderStatus = (id, status) => orderApi.post('/order-status/', { order_id: id, status });
