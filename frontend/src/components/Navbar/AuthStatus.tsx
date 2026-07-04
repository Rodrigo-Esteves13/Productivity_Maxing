import { LogoutIcon } from '../UI/Icons';

interface AuthStatusProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

export default function AuthStatus({ isAuthenticated, onLogout }: AuthStatusProps) {
  return (
    <div className="flex items-center ml-4">
      {isAuthenticated ? (
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 border border-red-900/50 rounded-md text-sm font-medium text-red-400 bg-red-950/30 hover:bg-red-900/50 hover:text-red-300 focus:outline-none transition-colors"
        >
          <LogoutIcon />
          Logout
        </button>
      ) : (
        <span className="text-sm font-medium text-neutral-500 italic">
          Not Authenticated
        </span>
      )}
    </div>
  );
}
