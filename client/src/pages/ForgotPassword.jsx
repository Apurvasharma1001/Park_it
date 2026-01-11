import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import heroImage from '../assets/login-hero.png';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [devPreviewLink, setDevPreviewLink] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/auth/forgotpassword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setSubmitted(true);
                // Special DX for development: Show the fake email link
                if (data.previewUrl) {
                    setDevPreviewLink(data.previewUrl);
                }
            } else {
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            setError('Failed to connect to server');
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
                        <h1 className="text-4xl font-bold mb-4">Password Recovery</h1>
                        <p className="text-lg text-slate-200 max-w-md">Don't worry, it happens to the best of us.</p>
                    </motion.div>
                </div>
            </div>

            {/* Right Side - Form Section */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-md w-full"
                >
                    {submitted ? (
                        <div className="text-center">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6"
                            >
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </motion.div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">Check your inbox</h2>
                            <p className="text-slate-600 mb-8">
                                We've sent a password reset link to <span className="font-semibold text-slate-800">{email}</span>
                            </p>

                            {/* Development Helper */}
                            {devPreviewLink && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left"
                                >
                                    <p className="text-sm font-semibold text-yellow-800 mb-1">🚧 Developer Mode:</p>
                                    <p className="text-sm text-yellow-700 mb-2">Since we are using a fake email server, click below to see the email:</p>
                                    <a
                                        href={devPreviewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline text-sm font-medium"
                                    >
                                        Open Fake Email Inbox
                                    </a>
                                </motion.div>
                            )}

                            <Link
                                to="/login"
                                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="mb-10">
                                <Link to="/login" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-6">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Link>
                                <h2 className="text-3xl font-bold text-slate-900">Forgot password?</h2>
                                <p className="mt-2 text-slate-600">Enter your email address to reset your password.</p>
                            </div>

                            <form className="space-y-6" onSubmit={handleSubmit}>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md"
                                    >
                                        <p className="text-sm text-red-700">{error}</p>
                                    </motion.div>
                                )}

                                <div className="relative group">
                                    <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">Email Address</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white hover:bg-slate-50 focus:bg-white"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-600/30"
                                >
                                    {loading ? (
                                        <span className="flex items-center space-x-2">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Sending link...
                                        </span>
                                    ) : (
                                        <span className="flex items-center">
                                            Send Reset Link
                                            <ArrowRight className="ml-2 w-4 h-4" />
                                        </span>
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default ForgotPassword;
