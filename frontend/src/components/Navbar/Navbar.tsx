import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import AuthStatus from './AuthStatus';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/'); 
  };

  return (
    <nav className="bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          <div className="flex-shrink-0">
            <Link 
              to={isAuthenticated ? "/dashboard" : "/"} 
              className="text-xl font-bold tracking-wider text-blue-400"
            >
              Productivity Maxing
            </Link>
          </div>

          {isAuthenticated && <NavLinks currentPath={location.pathname} />}
          <AuthStatus isAuthenticated={isAuthenticated} onLogout={handleLogout} />
          
        </div>
      </div>
    </nav>
  );
}