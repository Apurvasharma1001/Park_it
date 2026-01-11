import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Admin API
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getCustomers: () => api.get('/admin/customers'),
  getCustomerById: (id) => api.get(`/admin/customers/${id}`),
  getOwners: () => api.get('/admin/owners'),
  getOwnerById: (id) => api.get(`/admin/owners/${id}`),
  getBookings: () => api.get('/admin/bookings'),
  getParkingLots: () => api.get('/admin/parking-lots'),
};

export default api;

