import { useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Textarea from '../UI/Textarea';
import { useI18n } from '../../i18n/useI18n';
import type { FlashcardInput } from '../../api/flashcardsService';
import type { Area, Flashcard } from '../../types/models';

export const FLASHCARD_FRONT_MAX = 300;
export const FLASHCARD_BACK_MAX = 2000;

interface CardEditorProps {
  // Sem cartao = criar. O pai remonta (key) a cada abertura.
  card?: Flashcard;
  defaultAreaId?: string | null;
  areas: Area[];
  onSubmit: (input: FlashcardInput) => Promise<boolean>;
  onClose: () => void;
}

export default function CardEditor({ card, defaultAreaId = null, areas, onSubmit, onClose }: CardEditorProps) {
  const { t } = useI18n();
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [areaId, setAreaId] = useState(card ? card.areaId : defaultAreaId);
  const [isSaving, setIsSaving] = useState(false);
  const canSave = front.trim() !== '' && back.trim() !== '' && !isSaving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    const ok = await onSubmit({ front: front.trim(), back: back.trim(), areaId });
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={card ? t('flashcards.editCard') : t('flashcards.newCard')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <Input
          autoFocus
          label={t('flashcards.front')}
          value={front}
          maxLength={FLASHCARD_FRONT_MAX}
          onChange={(e) => setFront(e.target.value)}
        />
        <Textarea
          label={t('flashcards.back')}
          rows={4}
          value={back}
          maxLength={FLASHCARD_BACK_MAX}
          onChange={(e) => setBack(e.target.value)}
        />
        <Select label={t('flashcards.area')} value={areaId ?? ''} onChange={(e) => setAreaId(e.target.value || null)}>
          <option value="">{t('flashcards.noArea')}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!canSave}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
