import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import AuthStatus from './AuthStatus';
import { useAuth } from '../../context/AuthContext';


function getUserRole() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role;
  } catch (e) {
    return null;
  }
}

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = getUserRole();

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
          
          {/* 2. Links Normais + Link de Admin */}
          <div className="flex items-center gap-6">
            {isAuthenticated && <NavLinks currentPath={location.pathname} />}
            
            {/* O Link do Admin está agora dentro do Return, e usa a variável role! */}
            {role === 'ADMIN' && (
              <Link
                to="/areas"
                className={`text-sm font-bold transition-colors ${
                  location.pathname.includes('/admin')
                    ? 'text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md'
                    : 'text-amber-500/70 hover:text-amber-400 px-3 py-1.5'
                }`}
              >
                Áreas (Admin)
              </Link>
            )}
          </div>

          {/* 3. Botão de Logout */}
          <AuthStatus isAuthenticated={isAuthenticated} onLogout={handleLogout} />
          
        </div>
      </div>
    </nav>
  );
}