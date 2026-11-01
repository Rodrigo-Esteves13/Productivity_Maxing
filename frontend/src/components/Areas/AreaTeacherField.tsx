import { useEffect, useState, type FormEvent } from 'react';
import type { Area } from '../../types/models';
import { TEACHER_NAME_MAX_LENGTH } from '../../types/models';
import { useAreaTeacher } from '../../hooks/useAreaTeacher';
import { useI18n } from '../../i18n/useI18n';
import Input from '../UI/Input';
import Button from '../UI/Button';

interface AreaTeacherFieldProps {
  area: Area;
}

// Docente da cadeira. Nota PRIVADA do aluno (nunca vai para turmas/partilhas).
export default function AreaTeacherField({ area }: AreaTeacherFieldProps) {
  const { t } = useI18n();
  const { teacherName, autoFromSchedule, isLoading, isSaving, error, save } = useAreaTeacher(area.id);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(teacherName);
  }, [teacherName]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    void save(draft).then(setSaved);
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 border-t border-neutral-800 pt-4">
      <Input
        label={t('teacher.label')}
        value={draft}
        maxLength={TEACHER_NAME_MAX_LENGTH}
        placeholder={t('teacher.placeholder')}
        disabled={isLoading}
        onChange={(event) => setDraft(event.target.value)}
      />
      {/* Editar o texto torna-o manual: a dica some assim que o valor muda. */}
      {autoFromSchedule && draft.trim() === teacherName && teacherName !== '' && (
        <p className="mt-1 text-xs text-violet-400">{t('areaTeacher.fromSchedule')}</p>
      )}
      <p className="mt-1 text-xs text-neutral-500">{t('teacher.hint')}</p>
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isLoading || isSaving || draft.trim() === teacherName}>
          {draft.trim() === '' && teacherName !== '' ? t('teacher.clear') : t('teacher.save')}
        </Button>
      </div>
      {saved && !error && draft.trim() === teacherName && (
        <p role="status" className="mt-2 text-xs text-neutral-400">
          {t('teacher.saved')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {t('teacher.error')}
        </p>
      )}
    </form>
  );
}
