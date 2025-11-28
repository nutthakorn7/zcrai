import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:8000', // Direct to backend or via proxy
  withCredentials: true, // Important for Cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response Interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (e.g., redirect to login)
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
