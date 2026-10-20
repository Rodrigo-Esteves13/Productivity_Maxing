import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import CountBadge from '../UI/CountBadge';
import { socialTabPath } from '../../lib/appLinks';

interface NavLinksProps {
  currentPath: string;
  socialPending: number;
}

export default function NavLinks({ currentPath, socialPending }: NavLinksProps) {
  const { t } = useI18n();
  const getLinkClass = (path: string) => {
    const baseClass = "whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium leading-5 transition-colors";
    // Sub-paginas (ex: /social/friends/...) tambem marcam o link.
    const isActive = currentPath === path || currentPath.startsWith(`${path}/`);
    return isActive
      ? `${baseClass} bg-neutral-800 text-white` 
      : `${baseClass} text-neutral-400 hover:bg-neutral-800 hover:text-white`;
  };

  return (
    <div className="hidden xl:block">
      <div className="ml-6 flex items-center gap-1">
        <Link to="/dashboard" className={getLinkClass('/dashboard')}>{t('nav.dashboard')}</Link>
        <Link to="/tasks" className={getLinkClass('/tasks')}>{t('nav.tasks')}</Link>
        <Link to="/focus" className={getLinkClass('/focus')}>{t('nav.focus')}</Link>
        <Link to="/schedule" className={getLinkClass('/schedule')}>{t('nav.schedule')}</Link>
        <Link to="/notebook" className={getLinkClass('/notebook')}>{t('nav.notebook')}</Link>
        <Link to="/areas" className={getLinkClass('/areas')}>{t('nav.areas')}</Link>
        <Link
          to={socialPending > 0 ? socialTabPath('requests') : '/social'}
          className={`${getLinkClass('/social')} inline-flex items-center gap-1.5`}
        >
          {t('nav.social')}
          <CountBadge count={socialPending} label={t('nav.socialPending', { count: socialPending })} />
        </Link>
      </div>
    </div>
  );
}