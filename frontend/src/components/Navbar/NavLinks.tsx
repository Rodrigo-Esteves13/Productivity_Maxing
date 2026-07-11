import { Link } from 'react-router-dom';

interface NavLinksProps {
  currentPath: string;
}

export default function NavLinks({ currentPath }: NavLinksProps) {
  const getLinkClass = (path: string) => {
    const baseClass = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    return currentPath === path 
      ? `${baseClass} bg-neutral-800 text-white` 
      : `${baseClass} text-neutral-400 hover:bg-neutral-800 hover:text-white`;
  };

  return (
    <div className="hidden md:block">
      <div className="ml-10 flex items-baseline space-x-4">
        <Link to="/dashboard" className={getLinkClass('/dashboard')}>Dashboard</Link>
        <Link to="/tasks" className={getLinkClass('/tasks')}>Tasks</Link>
        <Link to="/focus" className={getLinkClass('/focus')}>Focus</Link>
        <Link to="/profile" className={getLinkClass('/profile')}>Profile</Link>
      </div>
    </div>
  );
}