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

          let userData = response.data.user;

          // For employees, also get onboarding status to complete the user state
          if (userData.role === "employee") {
            try {
              console.log(
                "🔍 Frontend Debug - Getting onboarding status for employee"
              );
              const onboardingResponse = await api.get(
                "/employee/onboarding-status"
              );
              const onboardingStatus = onboardingResponse.data;

              // Merge onboarding status with user profile
              userData = {
                ...userData,
                form_submitted: onboardingStatus.formSubmitted,
                hr_approved: onboardingStatus.hrApproved,
                onboarded: onboardingStatus.onboarded,
              };

              console.log(
                "🔍 Frontend Debug - Complete employee user data:",
                userData
              );
            } catch (onboardingError) {
              console.error(
                "❌ Frontend Debug - Failed to get onboarding status:",
                onboardingError
              );
              // Continue with basic user data if onboarding status fails
            }
          }

          setUser(userData);
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

          // If token is invalid, try to refresh it
          if (error.response?.status === 401) {
            console.log("🔄 Frontend Debug - Attempting to refresh token...");
            try {
              const refreshResponse = await api.post("/auth/refresh");
              console.log(
                "🔄 Frontend Debug - Token refresh successful:",
                refreshResponse.data
              );

              const { token: newToken } = refreshResponse.data;
              setToken(newToken);
              localStorage.setItem("token", newToken);
              api.defaults.headers.common[
                "Authorization"
              ] = `Bearer ${newToken}`;

              // Try to get profile again with new token
              const profileResponse = await api.get("/auth/profile");
              let userData = profileResponse.data.user;

              // For employees, also get onboarding status
              if (userData.role === "employee") {
                try {
                  const onboardingResponse = await api.get(
                    "/employee/onboarding-status"
                  );
                  const onboardingStatus = onboardingResponse.data;

                  userData = {
                    ...userData,
                    form_submitted: onboardingStatus.formSubmitted,
                    hr_approved: onboardingStatus.hrApproved,
                    onboarded: onboardingStatus.onboarded,
                  };
                } catch (onboardingError) {
                  console.error(
                    "❌ Frontend Debug - Failed to get onboarding status after token refresh:",
                    onboardingError
                  );
                }
              }

              setUser(userData);
              return;
            } catch (refreshError) {
              console.error(
                "❌ Frontend Debug - Token refresh failed:",
                refreshError
              );
            }
          }

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
      setUser({
        ...userData,
        form_submitted: userData.form_submitted || false,
        hr_approved: userData.hr_approved || false,
        onboarded: userData.onboarded || false,
      });
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
    } else {
      // If user is null, set the user data directly
      setUser(userData);
    }
  };

  // Refresh user status from backend
  const refreshUserStatus = async () => {
    try {
      const response = await api.get("/auth/profile");
      let updatedUser = response.data.user;

      // For employees, also get onboarding status
      if (updatedUser.role === "employee") {
        try {
          const onboardingResponse = await api.get(
            "/employee/onboarding-status"
          );
          const onboardingStatus = onboardingResponse.data;

          updatedUser = {
            ...updatedUser,
            form_submitted: onboardingStatus.formSubmitted,
            onboarded: onboardingStatus.onboarded,
          };
        } catch (onboardingError) {
          console.error("Failed to get onboarding status:", onboardingError);
        }
      }

      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error("Failed to refresh user status:", error);
      return { success: false, error: error.message };
    }
  };

  // Force refresh user onboarding status from backend
  const refreshOnboardingStatus = async () => {
    try {
      const response = await api.get("/employee/onboarding-status");
      const status = response.data;

      console.log("🔍 Backend onboarding status response:", status);

      // Update user state with latest onboarding status
      if (user) {
        const updatedUser = {
          ...user,
          form_submitted: status.formSubmitted,
          onboarded: status.onboarded,
          status: status.status,
        };
        console.log("🔍 Updated user object:", updatedUser);
        setUser(updatedUser);
        return { success: true, user: updatedUser };
      } else {
        // If no user, create a basic user object
        const basicUser = {
          id: "temp-id", // We don't have the actual ID here
          form_submitted: status.formSubmitted,
          onboarded: status.onboarded,
          status: status.status,
        };
        console.log("🔍 Created basic user object:", basicUser);
        setUser(basicUser);
        return { success: true, user: basicUser };
      }
    } catch (error) {
      console.error("Failed to refresh onboarding status:", error);
      return { success: false, error: error.message };
    }
  };

  // Force refresh complete user state (profile + onboarding status)
  const forceRefreshUserState = async () => {
    try {
      console.log("🔄 Force refreshing complete user state...");

      // Get basic profile
      const profileResponse = await api.get("/auth/profile");
      let userData = profileResponse.data.user;

      // For employees, also get onboarding status
      if (userData.role === "employee") {
        try {
          const onboardingResponse = await api.get(
            "/employee/onboarding-status"
          );
          const onboardingStatus = onboardingResponse.data;

          userData = {
            ...userData,
            form_submitted: onboardingStatus.formSubmitted,
            onboarded: onboardingStatus.onboarded,
          };

          console.log("🔍 Complete user state refreshed:", userData);
        } catch (onboardingError) {
          console.error(
            "Failed to get onboarding status during force refresh:",
            onboardingError
          );
        }
      }

      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error("Failed to force refresh user state:", error);
      return { success: false, error: error.message };
    }
  };

  // Manual token refresh function
  const refreshToken = async () => {
    try {
      console.log("🔄 Manual token refresh initiated...");
      const response = await api.post("/auth/refresh");
      console.log("🔄 Token refresh successful:", response.data);

      const { token: newToken } = response.data;
      setToken(newToken);
      localStorage.setItem("token", newToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

      // Update user data
      const profileResponse = await api.get("/auth/profile");
      setUser(profileResponse.data.user);

      return { success: true, token: newToken };
    } catch (error) {
      console.error("❌ Manual token refresh failed:", error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    refreshUserStatus,
    refreshOnboardingStatus,
    forceRefreshUserState,
    refreshToken,
  };

  // Expose refresh function globally for debugging
  if (typeof window !== "undefined") {
    window.refreshAuthToken = refreshToken;
    window.checkAuthStatus = () => ({
      hasToken: !!token,
      token: token,
      user: user,
      loading: loading,
    });
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthProvider };
