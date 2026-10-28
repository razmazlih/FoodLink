import axios from 'axios';
import { getAccessToken } from '../firebase';
import { API_USERBASE_URL, API_DISHBOARD_URL, API_ORDERLINE_URL } from '../config';

const allowed = [API_USERBASE_URL, API_DISHBOARD_URL, API_ORDERLINE_URL].map((url) => new URL(url, window.location.origin));
axios.interceptors.request.use(async (config) => {
    const url = new URL(config.url, config.baseURL || window.location.origin);
    if (allowed.some((base) => url.origin === base.origin && (url.pathname === base.pathname || url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/')))) {
        const token = await getAccessToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
