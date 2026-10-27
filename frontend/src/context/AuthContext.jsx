import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
    const [exp, setExp] = useState('');

    const handleLogout = useCallback(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('myReservations');
        localStorage.removeItem('orderId');
        localStorage.removeItem('cartItems');
        localStorage.removeItem('myOrders');
        localStorage.removeItem('myReservations');
        setUserId(null);
        setIsLoggedIn(false);
        navigate('/login');
    }, [navigate]);

    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken');
        if ((accessToken && !userId) || (!accessToken && userId)) {
            handleLogout();
        } else {
            setIsLoggedIn(!!accessToken);
        }
    }, [userId, handleLogout]);

    const handleLogin = (tokens) => {
        localStorage.setItem('accessToken', JSON.stringify(tokens));
        const { theUserId, theExp } = extractUserIdAndExpFromToken(
            tokens.access
        );
        setUserId(theUserId);
        localStorage.setItem('userId', theUserId);
        setExp(theExp);
        setIsLoggedIn(true);
    };

    const extractUserIdAndExpFromToken = (token) => {
        try {
            const payload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payload));
            const theUserId = decodedPayload.user_id;
            const theExp = decodedPayload.exp;
            return { theUserId, theExp };
        } catch (error) {
            console.error('Failed to extract user_id from token:', error);
            return null;
        }
    };

    return (
        <AuthContext.Provider
            value={{ isLoggedIn, handleLogin, handleLogout, userId, exp }}
        >
            {children}
        </AuthContext.Provider>
    );
};
