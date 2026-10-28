import React, { createContext, useState, useEffect } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase';

export const AuthContext = createContext();
const managerRole = async (user) => {
  if (!user) return null;
  const { claims } = await user.getIdTokenResult();
  const role = claims.admin === true ? 'admin' : claims.role;
  return ['admin', 'restaurant_owner'].includes(role) ? role : null;
};
const session = (user, role) => ({ user: user && role ? { id: user.uid, name: user.displayName || user.email, role } : null });

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ user: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (user) => {
      const current = ++revision;
      try {
        const role = await managerRole(user);
        if (active && current === revision) setAuth(session(user, role));
      } catch {
        if (active && current === revision) setAuth({ user: null });
      } finally {
        localStorage.removeItem('auth');
        if (active && current === revision) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const role = await managerRole(credential.user);
      if (!role) { await signOut(getFirebaseAuth()); return false; }
      setAuth(session(credential.user, role));
      return role;
    } catch {
      return false;
    }
  };
  const logout = async () => {
    await signOut(getFirebaseAuth());
    localStorage.removeItem('auth');
    setAuth({ user: null });
  };

  return <AuthContext.Provider value={{ auth, loading, login, logout }}>{loading ? null : children}</AuthContext.Provider>;
}
