import axios from "axios";
import { API_DISHBOARD_URL } from "../../../config";

export const getRestaurants = async () => {
    try {
        const { data } = await axios.get(`${API_DISHBOARD_URL}/restaurants/info/`);
        return data;
    } catch (error) {
        console.error("Error fetching restaurants:", error);
        throw error;
    }
};

export const getRestaurantsNamesAndIds = async () => {
    const data = await getRestaurants();
    return data.map(({ id, name }) => ({ id, name }));
};

export const getRestaurantById = async (id) => {
    try {
        const { data } = await axios.get(`${API_DISHBOARD_URL}/restaurants/info/${id}/`);
        return data;
    } catch (error) {
        console.error("Error fetching restaurant by ID:", error);
        throw error;
    }
};

export const isRestaurantOpen = async (restaurantId) => {
    try {
        const { data } = await axios.get(`${API_DISHBOARD_URL}/restaurants/opening-hours/when-open/?restaurant_id=${restaurantId}`);
        return data;
    } catch (error) {
        console.error("Error fetching restaurant opening hours:", error);
        throw error;
    }
};