import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          console.log("🔍 Frontend Debug - Token found:", token);
          console.log(
            "🔍 Frontend Debug - API base URL:",
            api.defaults.baseURL
          );

          // Set the token in API headers first
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          console.log(
            "🔍 Frontend Debug - Authorization header set:",
            api.defaults.headers.common["Authorization"]
          );

          // Try to validate the token by getting user profile
          console.log("🔍 Frontend Debug - Making API call to /auth/profile");
          const response = await api.get("/auth/profile");
          console.log("🔍 Frontend Debug - Profile response:", response.data);
          setUser(response.data.user);
        } catch (error) {
          console.error("❌ Frontend Debug - Token validation failed:", error);
          console.error("❌ Frontend Debug - Error response:", error.response);
          console.error(
            "❌ Frontend Debug - Error status:",
            error.response?.status
          );
          console.error(
            "❌ Frontend Debug - Error data:",
            error.response?.data
          );

          // Clear invalid token
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
          delete api.defaults.headers.common["Authorization"];
        }
      } else {
        console.log("🔍 Frontend Debug - No token found");
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  // Update API headers when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      console.log("🔍 Frontend Debug - Login attempt for:", email);
      console.log("🔍 Frontend Debug - API base URL:", api.defaults.baseURL);

      const response = await api.post("/auth/login", { email, password });
      console.log("🔍 Frontend Debug - Login response:", response.data);

      const { token: newToken, user: userData } = response.data;
      console.log(
        "🔍 Frontend Debug - New token received:",
        newToken ? "Yes" : "No"
      );
      console.log("🔍 Frontend Debug - User data received:", userData);

      // Store token and user data
      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);
      console.log("🔍 Frontend Debug - Token stored in localStorage");

      // Set API header immediately
      api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      console.log("🔍 Frontend Debug - Authorization header set after login");

      return { success: true };
    } catch (error) {
      console.error("❌ Frontend Debug - Login error:", error);
      console.error("❌ Frontend Debug - Error response:", error.response);
      throw new Error(error.response?.data?.error || "Login failed");
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post("/auth/logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
    }
  };

  const updateUser = (userData) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthProvider };
