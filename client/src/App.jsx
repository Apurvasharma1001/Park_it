import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OwnerDashboard from './pages/OwnerDashboard';
import UserDashboard from './pages/UserDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'OWNER' ? '/owner/dashboard' : '/customer/dashboard'} replace />;
  }

  return children;
};

// Guest Route Component - redirects authenticated users away
const GuestRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect authenticated users to their appropriate dashboard
    return <Navigate to={user?.role === 'OWNER' ? '/owner/dashboard' : '/customer/dashboard'} replace />;
  }

  return children;
};

// Home Component
const Home = () => {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return (
      <Navigate
        to={user?.role === 'OWNER' ? '/owner/dashboard' : '/customer/dashboard'}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">🅿️ Smart Parking System</h1>
        <p className="text-xl text-gray-600 mb-8">
          Find and book parking spaces near you
        </p>
        <div className="space-x-4">
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition inline-block"
          >
            Login
          </a>
          <a
            href="/register"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition inline-block"
          >
            Register
          </a>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <Register />
                </GuestRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <GuestRoute>
                  <ForgotPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/reset-password/:resetToken"
              element={
                <GuestRoute>
                  <ResetPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/owner/dashboard"
              element={
                <ProtectedRoute requiredRole="OWNER">
                  <OwnerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/dashboard"
              element={
                <ProtectedRoute requiredRole="CUSTOMER">
                  <UserDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;


