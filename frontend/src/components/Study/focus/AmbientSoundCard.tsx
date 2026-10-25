import { useEffect, useRef, useState } from 'react';
import Card from '../../UI/Card';
import Button from '../../UI/Button';
import SegmentedControl from '../../UI/SegmentedControl';
import { useI18n } from '../../../i18n/useI18n';
import { useAmbientSoundPref } from '../../../hooks/useAmbientSoundPref';
import { AMBIENT_KINDS, startAmbient, type AmbientKind, type AmbientPlayer } from '../../../lib/ambientNoise';

// Som de fundo para abafar o barulho a volta durante o estudo. Toca so
// enquanto esta pagina esta aberta e so depois de um clique (autoplay).
export default function AmbientSoundCard() {
  const { t } = useI18n();
  const { pref, setPref } = useAmbientSoundPref();
  const playerRef = useRef<AmbientPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // Sair da pagina desliga o som.
  useEffect(() => () => playerRef.current?.stop(), []);

  const play = (kind: AmbientKind) => {
    playerRef.current?.stop();
    try {
      playerRef.current = startAmbient(kind, pref.volume);
      setIsPlaying(true);
      setFailed(false);
    } catch {
      // Browser sem Web Audio (muito antigo) ou bloqueado.
      playerRef.current = null;
      setIsPlaying(false);
      setFailed(true);
    }
  };

  const toggle = () => {
    if (isPlaying) {
      playerRef.current?.stop();
      playerRef.current = null;
      setIsPlaying(false);
      return;
    }
    play(pref.kind);
  };

  const changeKind = (kind: AmbientKind) => {
    setPref({ ...pref, kind });
    if (isPlaying) play(kind);
  };

  const changeVolume = (volume: number) => {
    setPref({ ...pref, volume });
    playerRef.current?.setVolume(volume);
  };

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-white">{t('focus.ambient.title')}</h2>
      <p className="mb-4 text-sm text-neutral-400">{t('focus.ambient.help')}</p>
      <SegmentedControl
        size="sm"
        options={AMBIENT_KINDS.map((kind) => ({ value: kind, label: t(`focus.ambient.kind.${kind}`) }))}
        value={pref.kind}
        onChange={changeKind}
      />
      <label className="mt-4 flex items-center gap-3 text-sm text-neutral-300">
        <span className="shrink-0">{t('focus.ambient.volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={pref.volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
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
