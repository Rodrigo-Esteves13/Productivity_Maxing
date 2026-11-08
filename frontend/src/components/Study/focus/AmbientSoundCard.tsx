import Card from '../../UI/Card';
import Button from '../../UI/Button';
import SegmentedControl from '../../UI/SegmentedControl';
import { useI18n } from '../../../i18n/useI18n';
import { useAmbientSound } from '../../../context/useAmbientSound';
import { AMBIENT_KINDS } from '../../../lib/ambientNoise';

// Som de fundo para abafar o barulho a volta durante o estudo. O motor de
// audio vive no AmbientSoundProvider: continua a tocar ao mudar de pagina
// (com controlo no pill global) e so comeca depois de um clique (autoplay).
export default function AmbientSoundCard() {
  const { t } = useI18n();
  const { kind, volume, isPlaying, failed, toggle, setKind, setVolume } = useAmbientSound();

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-white">{t('focus.ambient.title')}</h2>
      <p className="mb-4 text-sm text-neutral-400">{t('ambientGlobal.help')}</p>
      <SegmentedControl
        size="sm"
        options={AMBIENT_KINDS.map((k) => ({ value: k, label: t(`focus.ambient.kind.${k}`) }))}
        value={kind}
        onChange={setKind}
      />
      <label className="mt-4 flex items-center gap-3 text-sm text-neutral-300">
        <span className="shrink-0">{t('focus.ambient.volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </label>
      <Button size="sm" variant={isPlaying ? 'secondary' : 'primary'} onClick={toggle} className="mt-4">
        {isPlaying ? t('focus.ambient.stop') : t('focus.ambient.play')}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {t('focus.ambient.error')}
        </p>
      )}
    </Card>
  );
}
