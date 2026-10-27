import axios from 'axios';

const userApi = axios.create({
  baseURL: process.env.REACT_APP_USER_BASE_URL,
});

const orderApi = axios.create({
  baseURL: process.env.REACT_APP_ORDER_LINE_URL,
});

const dashboardApi = axios.create({
  baseURL: process.env.REACT_APP_DISH_BOARD_URL,
});

export { userApi, orderApi, dashboardApi };