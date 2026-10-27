import axios from 'axios';
import { API_ORDERLINE_URL } from '../../../config';

export const addItemToCart = async (order) => {
    try {
        const { data } = await axios.post(`${API_ORDERLINE_URL}/order-item/`, {
            order_id: order.orderId,
            menu_item_id: order.menuItemId,
            quantity: order.quantity,
            price: order.price
        });
        return data;
    } catch (error) {
        console.error('Error adding item to cart:', error);
    }
};

export const updateQuantityById = async (itemId, newQuantity) => {
    try {
        const { data } = await axios.put(`${API_ORDERLINE_URL}/order-item/${itemId}/`, {
            quantity: newQuantity,
        });
        return data;
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
};

export const deleteItemFromCart = async (itemId) => {
    try {
        await axios.delete(`${API_ORDERLINE_URL}/order-item/${itemId}/`);
    } catch (error) {
        console.error('Error deleting item from server:', error);
    }
};