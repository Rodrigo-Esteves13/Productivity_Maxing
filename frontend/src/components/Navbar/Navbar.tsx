import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import AuthStatus from './AuthStatus';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login'); 
  };

  return (
    <nav className="bg-neutral-950 border-b border-neutral-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link 
              to={isAuthenticated ? "/dashboard" : "/"} 
              className="text-xl font-bold tracking-wider text-violet-500 hover:text-violet-400 transition-colors"
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