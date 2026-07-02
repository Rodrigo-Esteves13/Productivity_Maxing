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
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
        >
          Logout
        </button>
      ) : (
        <span className="text-sm font-medium text-gray-400 italic">
          Not Authenticated
        </span>
      )}
    </div>
  );
}