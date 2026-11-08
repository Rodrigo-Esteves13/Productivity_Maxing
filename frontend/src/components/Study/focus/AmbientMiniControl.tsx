import Select from '../../UI/Select';
import { VolumeIcon, VolumeOffIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import { useAmbientSound } from '../../../context/useAmbientSound';
import { AMBIENT_KINDS, type AmbientKind } from '../../../lib/ambientNoise';

// Controlo compacto do som de fundo para o pill global do Focus (visivel em
// qualquer pagina): ligar/desligar e, enquanto toca, trocar o tipo de ruido.
// Ligar continua a ser sempre um clique (autoplay), nunca automatico.
export default function AmbientMiniControl() {
  const { t } = useI18n();
  const { kind, isPlaying, toggle, setKind } = useAmbientSound();
  const label = isPlaying ? t('focus.ambient.stop') : t('focus.ambient.play');
  const Icon = isPlaying ? VolumeIcon : VolumeOffIcon;

  return (
    <div role="group" aria-label={t('focus.ambient.title')} className="flex items-center gap-1">
      {isPlaying && (
        <Select
          aria-label={t('focus.ambient.title')}
          value={kind}
          onChange={(e) => setKind(e.target.value as AmbientKind)}
          className="hidden w-24 py-1! text-xs! sm:block"
        >
          {AMBIENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`focus.ambient.kind.${k}`)}
            </option>
          ))}
        </Select>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={`${t('focus.ambient.title')}: ${label}`}
        aria-pressed={isPlaying}
        title={`${t('focus.ambient.title')}: ${label}`}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
          isPlaying ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
        }`}
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
