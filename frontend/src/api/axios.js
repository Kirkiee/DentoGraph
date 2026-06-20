import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  timeout: 30000,
});

// ===============================
// REQUEST INTERCEPTOR
// Attach JWT token to every request
// ===============================

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ===============================
// RESPONSE INTERCEPTOR
// Handle expired/invalid tokens globally
// ===============================

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || "";

    const isAuthError =
      status === 401 ||
      (status === 403 &&
        (message.toLowerCase().includes("expired") ||
          message.toLowerCase().includes("invalid token") ||
          message.toLowerCase().includes("authentication")));

    if (isAuthError) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("rememberMe");

      const currentPath = window.location.pathname;

      const isAuthPage =
        currentPath.includes("/auth/login") ||
        currentPath.includes("/auth/register") ||
        currentPath.includes("/register");

      if (!isAuthPage) {
        window.location.href = "/auth/login";
      }
    }

    return Promise.reject(error);
  },
);

export default API;
