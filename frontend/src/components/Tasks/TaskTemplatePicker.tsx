import { useState } from 'react';
import Select from '../UI/Select';
import { useTaskTemplates } from '../../hooks/useTaskTemplates';
import { MAX_TASK_TEMPLATES, MAX_TEMPLATE_NAME_LENGTH, type TaskTemplate } from '../../lib/taskTemplates';
import { useI18n } from '../../i18n/useI18n';
import { useFeedback } from '../../context/useFeedback';

interface TaskTemplatePickerProps {
  // Valores atuais do formulario, para "Guardar como modelo".
  buildDraft: (name: string) => Omit<TaskTemplate, 'id'>;
  onApply: (template: TaskTemplate) => void;
  // Nome sugerido ao guardar (o titulo atual da task).
  suggestedName: string;
}

const LINK_BUTTON = 'text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted disabled:opacity-50';

// Topo do formulario de nova task: aplicar um modelo ou guardar o atual.
export default function TaskTemplatePicker({ buildDraft, onApply, suggestedName }: TaskTemplatePickerProps) {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
  const { templates, saveTemplate, deleteTemplate, findByName, restoreTemplate, renameTemplate, isFull } =
    useTaskTemplates();
  const [selectedId, setSelectedId] = useState('');
  const [naming, setNaming] = useState<string | null>(null);
  // Modo do campo de nome: guardar o formulario atual ou renomear o modelo escolhido.
  const [isRenaming, setIsRenaming] = useState(false);
  const [message, setMessage] = useState('');
  const selected = templates.find((tpl) => tpl.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMessage('');
    const template = templates.find((tpl) => tpl.id === id);
    if (template) onApply(template);
  };

  const closeNaming = () => {
    setNaming(null);
    setIsRenaming(false);
  };

  const handleRename = () => {
    if (naming === null || !selected) return;
    const ok = renameTemplate(selected.id, naming);
    setMessage(ok ? t('ux4tasks.templateRenamed', { name: naming.trim() }) : t('ux4tasks.templateNameTaken'));
    if (ok) closeNaming();
  };

  const handleSave = async () => {
    if (naming === null) return;
    // Mesmo nome: substitui em silencio so depois de confirmar.
    const existing = findByName(naming);
    if (existing) {
      const replace = await confirm({
        title: t('ux4tasks.replaceTitle'),
        message: t('ux4tasks.replaceMessage', { name: existing.name }),
        confirmLabel: t('ux4tasks.replaceConfirm'),
        tone: 'danger',
      });
      if (!replace) return;
    }
    const ok = saveTemplate(buildDraft(naming));
    setMessage(ok ? t('taskTemplates.saved', { name: naming.trim() }) : t('taskTemplates.full', { max: MAX_TASK_TEMPLATES }));
    if (ok) closeNaming();
  };

  const handleDelete = (template: TaskTemplate) => {
    deleteTemplate(template.id);
    setSelectedId('');
    setMessage(t('taskTemplates.deleted', { name: template.name }));
    notify(t('taskTemplates.deleted', { name: template.name }), 'success', {
      label: t('undo.action'),
      onAction: () => restoreTemplate(template),
    });
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        {templates.length > 0 && (
          <div className="min-w-[12rem] flex-1">
            <Select
              id="task-template"
              label={t('taskTemplates.label')}
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="">{t('taskTemplates.none')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 pb-2.5">
          {naming === null ? (
            <button
              type="button"
              className={LINK_BUTTON}
              disabled={isFull}
              onClick={() => {
                setMessage('');
                setIsRenaming(false);
                setNaming(suggestedName.slice(0, MAX_TEMPLATE_NAME_LENGTH));
              }}
            >
              {t('taskTemplates.saveCurrent')}
            </button>
          ) : null}
          {selected && naming === null && (
            <button
              type="button"
              className={LINK_BUTTON}
              onClick={() => {
                setMessage('');
                setIsRenaming(true);
                setNaming(selected.name);
              }}
            >
              {t('ux4tasks.renameTemplate')}
            </button>
          )}
          {selected && (
            <button
              type="button"
              className="text-xs text-neutral-400 hover:text-red-400"
              onClick={() => handleDelete(selected)}
            >
              {t('taskTemplates.delete')}
            </button>
          )}
        </div>
      </div>
      {naming !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="task-template-name" className="sr-only">
            {t('taskTemplates.nameLabel')}
          </label>
          <input
            id="task-template-name"
            value={naming}
            maxLength={MAX_TEMPLATE_NAME_LENGTH}
            placeholder={t('taskTemplates.nameLabel')}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => {
              // Enter grava o modelo, nao submete o formulario da task.
              if (e.key === 'Enter') {
                e.preventDefault();
                if (isRenaming) handleRename();
                else void handleSave();
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={isRenaming ? handleRename : () => void handleSave()}
            disabled={!naming.trim()}
            className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
          >
            {t('common.save')}
          </button>
          <button type="button" onClick={closeNaming} className="text-sm text-neutral-400 hover:text-white">
            {t('ui.cancel')}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-500" role="status">
        {message || t('taskTemplates.help')}
      </p>
    </div>
  );
}
