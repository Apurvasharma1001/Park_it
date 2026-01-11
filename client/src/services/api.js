import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on auth pages or if it's a login/register request
      const isAuthRequest = error.config?.url?.includes('/auth/login') || 
                           error.config?.url?.includes('/auth/register');
      
      if (!isAuthRequest && !window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/register')) {
        // Clear auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Parking Lots API
export const parkingLotAPI = {
  getAll: (params) => api.get('/parking-lots', { params }),
  getById: (id) => api.get(`/parking-lots/${id}`),
  create: (data) => api.post('/parking-lots', data),
  update: (id, data) => api.put(`/parking-lots/${id}`, data),
  delete: (id) => api.delete(`/parking-lots/${id}`),
  getOwnerLots: () => api.get('/parking-lots/owner/my-lots'),
  updateSlotOccupancy: (lotId, slotId, data) =>
    api.put(`/parking-lots/${lotId}/slots/${slotId}/occupancy`, data),
  getCameras: () => api.get('/parking-lots/cameras'),
  testCamera: (source) => api.post('/parking-lots/test-camera', { source }),
  enableCamera: (id, data) => api.post(`/parking-lots/${id}/enable-camera`, data),
  defineSlots: (id, data) => api.post(`/parking-lots/${id}/define-slots`, data),
  getSlotStatus: (id) => api.get(`/parking-lots/${id}/slot-status`),
  refreshSlots: (id) => api.post(`/parking-lots/${id}/refresh-slots`),
  processFrame: (id, imageData) => api.post(`/parking-lots/${id}/process-frame`, { imageData }),
};

// Bookings API
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getAll: () => api.get('/bookings'),
  getById: (id) => api.get(`/bookings/${id}`),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
  complete: (id) => api.put(`/bookings/${id}/complete`),
};

export default api;


