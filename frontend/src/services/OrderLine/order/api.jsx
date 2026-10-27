import axios from 'axios';
import { API_ORDERLINE_URL } from '../../../config';

export const fetchOrder = async (orderId) => {
    try {
        const { data } = await axios.get(
            `${API_ORDERLINE_URL}/orders/${orderId}/`
        );
        return data;
    } catch (error) {
        console.error('Error feching order:', error);
        throw error;
    }
};

export const fetchAllOrders = async (userId) => {
    if (!userId) {
        return [];
    }
    try {
        const { data } = await axios.get(`${API_ORDERLINE_URL}/orders/?user_id=${userId}`);
        return data;
    } catch (error) {
        console.error('Error fetching all orders:', error);
        throw error;
    }
};

export const deleteOrder = async (orderId) => {
    try {
        const { data } = await axios.delete(
            `${API_ORDERLINE_URL}/orders/${orderId}`
        );
        return data;
    } catch (error) {
        console.error('Error deleting order:', error);
        throw error;
    }
};

export const createOrder = async (userId, restaurantId) => {
    try {
        const { data } = await axios.post(`${API_ORDERLINE_URL}/orders/`, {
            user_id: userId,
            restaurant_id: restaurantId,
        });
        return data;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};
