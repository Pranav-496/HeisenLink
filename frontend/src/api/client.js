import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
});

api.interceptors.request.use((config) => {
  const access = localStorage.getItem("heisenlink_access");
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }
    original._retry = true;
    const refresh = localStorage.getItem("heisenlink_refresh");
    if (!refresh) return Promise.reject(error);

    try {
      const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh });
      localStorage.setItem("heisenlink_access", data.access);
      if (data.refresh) localStorage.setItem("heisenlink_refresh", data.refresh);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      localStorage.removeItem("heisenlink_access");
      localStorage.removeItem("heisenlink_refresh");
      return Promise.reject(refreshError);
    }
  }
);

export default api;
