import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase';

export const AuthContext = createContext();
const privateKeys = ['accessToken', 'userId', 'myReservations', 'orderId', 'cartItems', 'myOrders', 'cartNames'];
const clearSession = () => privateKeys.forEach((key) => localStorage.removeItem(key));

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => onAuthStateChanged(getFirebaseAuth(), (user) => {
        if (localStorage.getItem('userId') !== (user?.uid || null)) clearSession();
        if (user) localStorage.setItem('userId', user.uid);
        // Firebase owns token persistence and refresh; never store raw tokens ourselves.
        localStorage.removeItem('accessToken');
        setUserId(user?.uid || null);
        setLoading(false);
    }), []);

    const handleLogout = useCallback(async () => {
        await signOut(getFirebaseAuth());
        clearSession();
        setUserId(null);
        navigate('/login');
    }, [navigate]);
    const handleLogin = useCallback((user) => {
        if (localStorage.getItem('userId') !== user.uid) clearSession();
        localStorage.setItem('userId', user.uid);
        setUserId(user.uid);
    }, []);

    return <AuthContext.Provider value={{ isLoggedIn: !!userId, handleLogin, handleLogout, userId, loading }}>
        {loading ? null : children}
    </AuthContext.Provider>;
};
