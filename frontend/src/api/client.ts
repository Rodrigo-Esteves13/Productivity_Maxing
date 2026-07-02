import axios from 'axios';

// Create the base Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});


// Before any request leaves for the backend, this code runs.
api.interceptors.request.use(
  (config) => {
    // Fetch the token from localStorage
    const token = localStorage.getItem('token');
    
    // If the token exists, attach it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Listens to API responses. If the backend says the token expired (401),
// we clear the session and force a logout automatically.
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session expired or unauthorized. Logging out...');
      localStorage.removeItem('token');
      // Redirect to root/login (forces a page refresh to clear app state)
      window.location.href = '/'; 
    }
    return Promise.reject(error);
  }
);

export default api;