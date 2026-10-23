import { useCallback, useState } from 'react';
import { getPad, lockPad, savePad, unlockPad } from '../api/padsService';
import type { PadView } from '../types/models';
import { useVersionedDoc, type VersionedSnapshot } from './useVersionedDoc';

const toSnapshot = (pad: PadView): VersionedSnapshot<string> => ({ doc: pad.content, version: pad.version });

function parsePadConflict(body: unknown): VersionedSnapshot<string> | null {
  const current = (body as { current?: PadView } | null)?.current;
  return current && typeof current.content === 'string' ? toSnapshot(current) : null;
}

export interface PadMeta {
  locked: boolean;
  lockedByMe: boolean;
  maxLength: number | null;
}

const toMeta = ({ locked, lockedByMe, maxLength }: PadView): PadMeta => ({ locked, lockedByMe, maxLength });

// Texto de um pad, com gravacao automatica e as alteracoes dos outros, mais
// o estado de tranca e o limite de tamanho de quem esta a ver.
export function usePad(slug: string) {
  const [meta, setMeta] = useState<PadMeta | null>(null);

  const load = useCallback(async () => {
    const pad = await getPad(slug);
    setMeta(toMeta(pad));
    return toSnapshot(pad);
  }, [slug]);
  const save = useCallback(
    async (content: string, baseVersion: number) => {
      const pad = await savePad(slug, content, baseVersion);
      setMeta(toMeta(pad));
      return toSnapshot(pad);
    },
    [slug],
  );
  const doc = useVersionedDoc<string>({ key: slug, load, save, parseConflict: parsePadConflict, enabled: slug !== '' });

  const setLocked = useCallback(
    async (locked: boolean) => {
      const pad = await (locked ? lockPad(slug) : unlockPad(slug));
      setMeta(toMeta(pad));
    },
    [slug],
  );

  return { ...doc, meta, setLocked };
}
