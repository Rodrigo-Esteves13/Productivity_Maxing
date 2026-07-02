import { Link, useNavigate } from 'react-router-dom';

interface NavbarProps {
  isAuthenticated: boolean;
}

export default function Navbar({ isAuthenticated }: NavbarProps) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/');
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
      <Link to={isAuthenticated ? '/dashboard' : '/'} className="text-lg font-bold text-violet-400">
        Producitivity Maxing
      </Link>

      {isAuthenticated ? (
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-neutral-300 hover:text-white">
            Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm border border-neutral-700 rounded px-3 py-1 text-neutral-300 hover:text-white hover:border-neutral-500"
          >
            Sair
          </button>
        </div>
      ) : (
        <span className="text-sm text-neutral-500">Não autenticado</span>
      )}
    </nav>
  );
}