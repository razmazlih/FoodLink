import axios from 'axios';
import { API_ORDERLINE_URL } from '../../../config';

export const updateCartStatus = async (orderId, status) => {
    try {
        const { data } = await axios.post(
            `${API_ORDERLINE_URL}/order-status/`,
            {
                order_id: orderId,
                status,
            }
        );
        return data;
    } catch (error) {
        console.error('Error checkout cart:', error);
    }
};
