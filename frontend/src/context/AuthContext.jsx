import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const storeTokens = (tokens) => {
    localStorage.setItem("heisenlink_access", tokens.access);
    localStorage.setItem("heisenlink_refresh", tokens.refresh);
  };

  const loadMe = async () => {
    const { data } = await api.get("/me/");
    setUser(data);
    return data;
  };

  useEffect(() => {
    const access = localStorage.getItem("heisenlink_access");
    if (!access) {
      setBooting(false);
      return;
    }
    loadMe().catch(() => setUser(null)).finally(() => setBooting(false));
  }, []);

  const login = async ({ username, password }) => {
    const { data } = await api.post("/auth/login/", { username, password });
    storeTokens(data);
    return loadMe();
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register/", payload);
    return data;
  };

  const verifyEmail = async (payload) => {
    const { data } = await api.post("/auth/verify-email/", payload);
    storeTokens(data);
    setUser(data.user);
    return data.user;
  };

  const verifyPending = async (payload) => {
    const { data } = await api.post("/auth/verify-pending/", payload);
    storeTokens(data);
    setUser(data.user);
    return data.user;
  };

  const resendOtp = async (email) => {
    const { data } = await api.post("/auth/resend-otp/", { email });
    return data;
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post("/auth/forgot-password/", { email });
    return data;
  };

  const resetPassword = async (payload) => {
    const { data } = await api.post("/auth/reset-password/", payload);
    return data;
  };

  const googleLogin = async (credential) => {
    const { data } = await api.post("/auth/google/", { credential });
    if (data.requires_verification) return data;
    storeTokens(data);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("heisenlink_access");
    localStorage.removeItem("heisenlink_refresh");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      setUser,
      booting,
      login,
      register,
      verifyEmail,
      verifyPending,
      resendOtp,
      forgotPassword,
      resetPassword,
      googleLogin,
      logout,
    }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
