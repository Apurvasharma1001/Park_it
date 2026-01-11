import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/customers', label: 'Customers', icon: '👥' },
    { path: '/admin/owners', label: 'Owners', icon: '🏢' },
    { path: '/admin/bookings', label: 'Bookings', icon: '📅' },
    { path: '/admin/parking-lots', label: 'Parking Lots', icon: '🅿️' },
  ];

  return (
    <div className="bg-gray-900 text-white w-64 min-h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Parkit Admin</h1>
        <p className="text-gray-400 text-sm mt-1">Management Panel</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  location.pathname === item.path
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;

