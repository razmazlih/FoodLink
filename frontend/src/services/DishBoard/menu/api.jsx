import axios from "axios";
import { API_DISHBOARD_URL } from "../../../config";

export const getRestaurantMenu = async (restaurantId) => {
    try {
        const { data } = await axios.get(`${API_DISHBOARD_URL}/menu/category/?restaurant_id=${restaurantId}`);
        return data;
    } catch (error) {
        console.error("Error fetching restaurant menu:", error);
        throw error;
    }
};

export const getMenuItemNameById = async (menuItemId) => {
    try {
        const { data } = await axios.get(`${API_DISHBOARD_URL}/menu/item/${menuItemId}`);
        return data.name;
    } catch (error) {
        console.error("Error fetching menu item by ID:", error);
        throw error;
    }
};