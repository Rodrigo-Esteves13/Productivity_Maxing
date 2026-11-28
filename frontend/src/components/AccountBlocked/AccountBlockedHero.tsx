import { ShieldIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { blockedSeverity, formatRemaining } from '../../lib/accountBlocked';
import type { LoadState } from './useAccountBlocked';

const HERO_STYLES = {
  banned: {
    band: 'bg-gradient-to-b from-red-950/60 to-black border-red-900/60',
    iconBg: 'bg-red-950 border-red-900',
    iconColor: 'text-red-400',
    eyebrow: 'text-red-400',
  },
  suspended: {
    band: 'bg-gradient-to-b from-amber-950/40 to-black border-amber-900/50',
    iconBg: 'bg-amber-950/70 border-amber-800',
    iconColor: 'text-amber-400',
    eyebrow: 'text-amber-400',
  },
  lifted: {
    band: 'bg-gradient-to-b from-violet-950/40 to-black border-violet-900/50',
    iconBg: 'bg-violet-950/70 border-violet-800',
    iconColor: 'text-violet-400',
    eyebrow: 'text-violet-400',
  },
  neutral: {
    band: 'bg-gradient-to-b from-neutral-900 to-black border-neutral-800',
    iconBg: 'bg-neutral-900 border-neutral-800',
    iconColor: 'text-neutral-400',
    eyebrow: 'text-neutral-400',
  },
} as const;

// Faixa a toda a largura, cor por severidade - a intenção é dar logo, de
// relance, o mesmo peso visual de um ecrã de suspensão de uma app grande
// (Discord/Xbox/Steam), em vez de um cartão pequeno perdido no meio de um
// ecrã preto vazio.
export default function AccountBlockedHero({ load }: { load: LoadState }) {
  const { t } = useI18n();
  const severity = blockedSeverity(load.status === 'loaded' ? load.data.status : null);
  const hero = HERO_STYLES[severity];

  return (
    <div className={`w-full border-b ${hero.band}`}>
      <div className="max-w-2xl mx-auto px-6 py-14 sm:py-20 text-center">
        <div
          className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border ${hero.iconBg}`}
        >
          <ShieldIcon className={`h-10 w-10 ${hero.iconColor}`} />
        </div>

        <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-3 ${hero.eyebrow}`}>
          {severity === 'lifted' && t('ui.restrictionLifted')}
          {severity === 'banned' && t('ui.accountBanned')}
          {severity === 'suspended' && t('ui.accountSuspended')}
          {severity === 'neutral' && t('ui.accountRestricted')}
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          {load.status === 'loading' && t('ui.checkingYourAccount')}
          {load.status === 'error' && t('ui.accountRestricted')}
          {severity === 'lifted' && t('ui.youreBackIn')}
          {severity === 'suspended' && t('ui.yourAccessIsTemporarilyOn')}
          {severity === 'banned' && t('ui.yourAccessHasBeenPermanently')}
        </h1>

        {severity === 'suspended' && load.status === 'loaded' && load.data.suspendedUntil && (
          <p className="mt-3 text-sm text-amber-200/80">
            {t('ui.timeRemaining')}{' '}
            <span className="font-semibold text-amber-100">
              {formatRemaining(load.data.suspendedUntil)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
