import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Car, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import heroImage from '../assets/login-hero.png';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CUSTOMER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: '',
  });

  const { register } = useAuth();
  const navigate = useNavigate();

  const checkPasswordStrength = (password) => {
    let score = 0;
    const feedback = [];

    if (password.length >= 6) score += 1;
    else feedback.push('At least 6 characters');

    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase');
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase');
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Add numbers');
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Add symbols');

    return {
      score: Math.min(score, 5),
      feedback: feedback.length > 0 ? feedback.slice(0, 1).join(', ') : 'Strong password',
    };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    setError('');

    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password.');
      return;
    }

    setLoading(true);

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.role
    );

    if (result.success) {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user.role === 'OWNER') {
        navigate('/owner/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Side - Image Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900/60 z-10" />
        <motion.img
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5 }}
          src={heroImage}
          alt="Future of Parking"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 flex flex-col justify-end h-full p-16 text-white">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <h1 className="text-4xl font-bold mb-4">Join the Revolution</h1>
            <p className="text-lg text-slate-200 max-w-md">Whether you're looking for a spot or managing a lot, ParkIt makes it effortless.</p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="max-w-lg w-full">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900">Create Account</h2>
            <p className="mt-2 text-slate-600">Get started with ParkIt in seconds.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center text-sm"
              >
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => handleRoleSelect('CUSTOMER')}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-2 ${formData.role === 'CUSTOMER'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-600'
                  }`}
              >
                <Car className={`w-8 h-8 ${formData.role === 'CUSTOMER' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-semibold text-sm">I want to Park</span>
                {formData.role === 'CUSTOMER' && <div className="absolute top-2 right-2 text-blue-600"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>

              <div
                onClick={() => handleRoleSelect('OWNER')}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-2 ${formData.role === 'OWNER'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-600'
                  }`}
              >
                <Building2 className={`w-8 h-8 ${formData.role === 'OWNER' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-semibold text-sm">I own a Parking Lot</span>
                {formData.role === 'OWNER' && <div className="absolute top-2 right-2 text-blue-600"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>
            </div>

            <div className="relative group">
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  name="name"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="relative group">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  name="email"
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    name="password"
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Create password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Repeat password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="space-y-1">
                <div className="flex h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.score <= 2 ? 'bg-red-500' :
                        passwordStrength.score <= 3 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Strength: <span className={`font-medium ${passwordStrength.score <= 2 ? 'text-red-500' :
                      passwordStrength.score <= 3 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                    {passwordStrength.score <= 2 ? 'Weak' : passwordStrength.score <= 3 ? 'Mediocre' : 'Strong'}
                  </span></span>
                  <span>{passwordStrength.feedback}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
