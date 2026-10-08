import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      if (!localStorage.getItem('token')) {
        setLoading(false);
        return;
      }
      try {
        // Trust the server's current role, not editable browser storage.
        const { data } = await authAPI.getMe();
        if (!cancelled) {
          localStorage.setItem('user', JSON.stringify(data.data));
          setUser(data.data);
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const saveSession = response => {
    const { token, ...userData } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };
  const login = async (email, password) => saveSession(await authAPI.login({ email, password }));
  const register = async (name, email, password) => saveSession(await authAPI.register({ name, email, password }));

  const logout = async () => {
    try { await authAPI.logout(); }
    catch (error) {
      // An already-expired/revoked session is also logged out.
      if (error.response?.status !== 401) throw error;
    }
    clearSession();
  };

  const updateUser = userData => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser,
    isAuthenticated: !!user, isAdmin: user?.role === 'admin' }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
