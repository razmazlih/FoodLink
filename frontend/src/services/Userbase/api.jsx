import axios from "axios";
import { API_USERBASE_URL } from "../../config";


export const userCredentials = async (user) => {
    try {
        const { data } = await axios.post(`${API_USERBASE_URL}/login/`, user);
        return data;
    } catch (error) {
        console.error("Error login user:", error);
        throw error;
    }
};

export const registerUser = async (user) => {
    try {
        const { data } = await axios.post(`${API_USERBASE_URL}/users/register/`, user);
        return data;
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
};