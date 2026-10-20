import { useI18n } from '../../i18n/useI18n';
import CountBadge from '../UI/CountBadge';
import PrefetchLink from '../UI/PrefetchLink';
import { MAIN_NAV, SOCIAL_PATH, isNavActive, socialNavTarget } from './navItems';

interface NavLinksProps {
  currentPath: string;
  socialPending: number;
}

const BASE_CLASS = 'whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium leading-5 transition-colors';
const ACTIVE_CLASS = `${BASE_CLASS} bg-neutral-800 text-white`;
const IDLE_CLASS = `${BASE_CLASS} text-neutral-400 hover:bg-neutral-800 hover:text-white`;

export default function NavLinks({ currentPath, socialPending }: NavLinksProps) {
  const { t } = useI18n();
  const linkClass = (path: string) => (isNavActive(currentPath, path) ? ACTIVE_CLASS : IDLE_CLASS);

  return (
    <div className="hidden xl:block">
      <div className="ml-6 flex items-center gap-1">
        {MAIN_NAV.map((item) => (
          <PrefetchLink key={item.to} to={item.to} className={linkClass(item.to)}>
            {t(item.labelKey)}
          </PrefetchLink>
        ))}
        <PrefetchLink
          to={socialNavTarget(socialPending)}
          className={`${linkClass(SOCIAL_PATH)} inline-flex items-center gap-1.5`}
        >
          {t('nav.social')}
          <CountBadge count={socialPending} label={t('nav.socialPending', { count: socialPending })} />
        </PrefetchLink>
      </div>
    </div>
  );
}
