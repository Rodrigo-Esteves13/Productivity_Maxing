import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  importTaskPack,
  previewTaskPack,
  type ImportTaskPackResult,
  type TaskPackPreview,
} from '../api/taskPackService';
import { getUserAreas } from '../api/userService';
import { getHttpStatus } from '../lib/httpError';
import type { Area } from '../types/models';

export type ImportLoadState = 'loading' | 'ready' | 'not-found' | 'error';

export function useTaskPackImport(code: string | undefined) {
  const [state, setState] = useState<ImportLoadState>('loading');
  const [preview, setPreview] = useState<TaskPackPreview | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [areaChoice, setAreaChoice] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportTaskPackResult | null>(null);
  const [importError, setImportError] = useState(false);
  // Substituir: apaga as tasks atuais nas mesmas cadeiras antes de importar.
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    if (!code) {
      setState('not-found');
      return;
    }
    let cancelled = false;
    setState('loading');
    Promise.all([previewTaskPack(code), getUserAreas()])
      .then(([pack, areaList]) => {
        if (cancelled) return;
        setPreview(pack);
        setAreas(areaList);
        // Por defeito: tudo marcado, menos o que o utilizador ja tem.
        setSelected(new Set(pack.items.filter((i) => !i.alreadyHave).map((i) => i.id)));
        setAreaChoice(
          Object.fromEntries(
            pack.items
              .filter((i) => i.fixedAreaId === null && i.suggestedAreaId !== null)
              .map((i) => [i.id, i.suggestedAreaId as string]),
          ),
        );
        setState('ready');
      })
      .catch((caught) => {
        if (!cancelled) setState(getHttpStatus(caught) === 404 ? 'not-found' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const toggle = useCallback((itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(preview?.items.map((i) => i.id) ?? []));
  }, [preview]);

  const selectNone = useCallback(() => setSelected(new Set()), []);

  const chooseArea = useCallback((itemId: string, areaId: string) => {
    setAreaChoice((prev) => ({ ...prev, [itemId]: areaId }));
  }, []);

  // Um item de cadeira pessoal so se pode importar com cadeira escolhida.
  const missingArea = useMemo(
    () =>
      (preview?.items ?? []).some(
        (i) => selected.has(i.id) && i.fixedAreaId === null && !areaChoice[i.id],
      ),
    [preview, selected, areaChoice],
  );

  const runImport = useCallback(async () => {
    if (!code || !preview) return;
    setIsImporting(true);
    setImportError(false);
    try {
      const items = preview.items
        .filter((i) => selected.has(i.id))
        .map((i) => ({ itemId: i.id, ...(i.fixedAreaId === null ? { areaId: areaChoice[i.id] } : {}) }));
      setResult(await importTaskPack(code, items, replaceExisting));
    } catch {
      setImportError(true);
    } finally {
      setIsImporting(false);
    }
  }, [code, preview, selected, areaChoice, replaceExisting]);

  return {
    state,
    preview,
    areas,
    selected,
    areaChoice,
    isImporting,
    result,
    importError,
    missingArea,
    replaceExisting,
    setReplaceExisting,
    toggle,
    selectAll,
    selectNone,
    chooseArea,
    runImport,
  };
}
