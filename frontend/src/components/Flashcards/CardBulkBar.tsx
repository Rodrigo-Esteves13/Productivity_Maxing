import { useState } from 'react';
import Button from '../UI/Button';
import Select from '../UI/Select';
import SelectionToolbar from '../UI/SelectionToolbar';
import { TrashIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { BULK_ACTION_MAX } from '../../lib/batch';
import type { Area } from '../../types/models';

// Valores do select que nao sao um id de cadeira.
const PLACEHOLDER = '';
const NO_AREA = '-';

interface CardBulkBarProps {
  selectedCount: number;
  listCount: number;
  areas: Area[];
  onSelectAll: () => void;
  onSelectNone: () => void;
  onMove: (areaId: string | null) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

// Selecionar varios cartoes da lista visivel: mudar de cadeira ou apagar.
export default function CardBulkBar({
  selectedCount,
  listCount,
  areas,
  onSelectAll,
  onSelectNone,
  onMove,
  onDelete,
}: CardBulkBarProps) {
  const { t } = useI18n();
  const [isBusy, setIsBusy] = useState(false);

  const act = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-3 ${
        selectedCount > 0
          ? 'sticky top-2 z-20 rounded-lg border border-violet-800/50 bg-neutral-900/95 px-3 py-2 backdrop-blur'
          : ''
      }`}
    >
      <SelectionToolbar
        selectedCount={selectedCount}
        selectableCount={Math.min(listCount, BULK_ACTION_MAX)}
        onSelectAll={onSelectAll}
        onSelectNone={onSelectNone}
        className="pointer-coarse:[&>button]:min-h-11"
      />
      {listCount > BULK_ACTION_MAX && (
        <span className="text-xs text-neutral-500">{t('ux4global.cards.limit', { count: BULK_ACTION_MAX })}</span>
      )}
      {selectedCount > 0 && (
        <>
          <p role="status" className="text-sm tabular-nums text-neutral-200">
            {t('ux4global.cards.selected', { count: selectedCount })}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={PLACEHOLDER}
              aria-label={t('ux4global.cards.move')}
              disabled={isBusy}
              onChange={(e) => {
                const value = e.target.value;
                if (value !== PLACEHOLDER) void act(() => onMove(value === NO_AREA ? null : value));
              }}
              className="py-1 text-sm"
            >
              <option value={PLACEHOLDER}>{t('ux4global.cards.move')}</option>
              <option value={NO_AREA}>{t('flashcards.noArea')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isBusy}
              onClick={() => void act(onDelete)}
              className="flex items-center gap-1.5"
            >
              <TrashIcon />
              {t('common.delete')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
