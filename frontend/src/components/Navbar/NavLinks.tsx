import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';

interface NavLinksProps {
  currentPath: string;
}

export default function NavLinks({ currentPath }: NavLinksProps) {
  const { t } = useI18n();
  const getLinkClass = (path: string) => {
    const baseClass = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    return currentPath === path 
      ? `${baseClass} bg-neutral-800 text-white` 
      : `${baseClass} text-neutral-400 hover:bg-neutral-800 hover:text-white`;
  };

  return (
    <div className="hidden md:block">
      <div className="ml-10 flex items-baseline space-x-4">
        <Link to="/dashboard" className={getLinkClass('/dashboard')}>{t('nav.dashboard')}</Link>
        <Link to="/tasks" className={getLinkClass('/tasks')}>{t('nav.tasks')}</Link>
        <Link to="/focus" className={getLinkClass('/focus')}>{t('nav.focus')}</Link>
        <Link to="/schedule" className={getLinkClass('/schedule')}>{t('nav.schedule')}</Link>
        <Link to="/notebook" className={getLinkClass('/notebook')}>{t('nav.notebook')}</Link>
        <Link to="/areas" className={getLinkClass('/areas')}>{t('nav.areas')}</Link>
        <Link to="/shared-with-me" className={getLinkClass('/shared-with-me')}>{t('nav.sharedWithMe')}</Link>
        <Link to="/social" className={getLinkClass('/social')}>{t('nav.social')}</Link>
        <Link to="/profile" className={getLinkClass('/profile')}>{t('nav.profile')}</Link>
      </div>
    </div>
  );
}