import { useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Textarea from '../UI/Textarea';
import { useI18n } from '../../i18n/useI18n';
import { parseFlashcardText } from '../../lib/flashcardImport';
import type { Area } from '../../types/models';

interface ImportCardsModalProps {
  areas: Area[];
  existingFronts: string[];
  defaultAreaId: string | null;
  onImport: (cards: { front: string; back: string }[], areaId: string | null) => Promise<boolean>;
  onClose: () => void;
}

const PREVIEW_ROWS = 5;

// Cola texto "frente<TAB>verso" (Quizlet, Anki, folha de calculo), ve o
// resumo e importa de uma vez. O pai remonta (key) a cada abertura.
export default function ImportCardsModal({ areas, existingFronts, defaultAreaId, onImport, onClose }: ImportCardsModalProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [areaId, setAreaId] = useState<string | null>(defaultAreaId);
  const [isSaving, setIsSaving] = useState(false);
  const parsed = useMemo(() => parseFlashcardText(text, existingFronts), [text, existingFronts]);
  const canImport = parsed.cards.length > 0 && !isSaving;

  const submit = async () => {
    if (!canImport) return;
    setIsSaving(true);
    const ok = await onImport(parsed.cards, areaId);
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={t('flashcardImport.title')}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-400">{t('flashcardImport.help')}</p>
        <Textarea
          label={t('flashcardImport.text')}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('flashcardImport.placeholder')}
        />
        <Select label={t('flashcards.area')} value={areaId ?? ''} onChange={(e) => setAreaId(e.target.value || null)}>
          <option value="">{t('flashcards.noArea')}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        {text.trim() !== '' && (
          <div className="rounded-lg border border-neutral-800 p-3 text-sm" role="status">
            <p className="text-neutral-200">
              {t('flashcardImport.summary', { ready: parsed.cards.length, skipped: parsed.skipped.length })}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-neutral-400">
              {parsed.cards.slice(0, PREVIEW_ROWS).map((card) => (
                <li key={card.front} className="truncate">
                  {card.front} / {card.back}
                </li>
              ))}
              {parsed.skipped.slice(0, PREVIEW_ROWS).map((skip) => (
                <li key={`skip-${skip.line}`} className="text-amber-300">
                  {t(`flashcardImport.skip.${skip.reason}`, { line: skip.line })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button type="button" size="sm" disabled={!canImport} onClick={() => void submit()}>
            {t('flashcardImport.action', { count: parsed.cards.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
