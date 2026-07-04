import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import UserMenu from './UserMenu';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // O role vem agora diretamente dos dados reais do user (AuthContext),
  // em vez de andar a descodificar o JWT à mão.
  const role = user?.role;

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
                className={`text-sm font-bold transition-colors px-3 py-1.5 rounded-md ${
                  location.pathname.startsWith('/areas')
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
                }`}
              >
                Areas
              </Link>
            )}
          </div>

          {/* 3. Menu do Utilizador (avatar + nome + Profile/Logout) */}
          {isAuthenticated ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <span className="text-sm font-medium text-neutral-500 italic">
              Not Authenticated
            </span>
          )}
          
        </div>
      </div>
    </nav>
  );
}