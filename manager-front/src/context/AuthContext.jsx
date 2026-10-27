import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    user: null,
    token: null,
  });

  // Check for an existing session on component mount
  useEffect(() => {
    const savedAuth = JSON.parse(localStorage.getItem('auth'));
    if (savedAuth) {
      setAuth(savedAuth);
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedAuth.token}`;
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/login`, {
        email,
        password,
      });
      const { user, token } = response.data;
      setAuth({ user, token });
      localStorage.setItem('auth', JSON.stringify({ user, token }));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setAuth({ user: null, token: null });
    localStorage.removeItem('auth');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}