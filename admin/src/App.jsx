import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Owners from './pages/Owners';
import Bookings from './pages/Bookings';
import ParkingLots from './pages/ParkingLots';
import CustomerDetail from './pages/CustomerDetail';
import OwnerDetail from './pages/OwnerDetail';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/customers" element={<Customers />} />
          <Route path="/admin/customers/:id" element={<CustomerDetail />} />
          <Route path="/admin/owners" element={<Owners />} />
          <Route path="/admin/owners/:id" element={<OwnerDetail />} />
          <Route path="/admin/bookings" element={<Bookings />} />
          <Route path="/admin/parking-lots" element={<ParkingLots />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

