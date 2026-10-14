import type { RefObject } from 'react';
import { convertTextCase, TEXT_CASE_OPTIONS, type TextCaseId } from '../../lib/textCase';
import { useI18n } from '../../i18n/useI18n';

interface CaseTransformBarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  textContent: string;
  onTextChange: (text: string) => void;
}

// Converte a SELECAO (ou o texto todo, se nao houver selecao) para
// minusculas, MAIUSCULAS, invertido, camelCase, etc. Os botoes usam
// onMouseDown+preventDefault para a textarea nao perder o foco/selecao.
export default function CaseTransformBar({ textareaRef, textContent, onTextChange }: CaseTransformBarProps) {
  const { t } = useI18n();

  const apply = (id: TextCaseId) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const from = hasSelection ? start : 0;
    const to = hasSelection ? end : textContent.length;

    const converted = convertTextCase(textContent.slice(from, to), id);
    onTextChange(textContent.slice(0, from) + converted + textContent.slice(to));

    // Repoe a selecao sobre o texto convertido, depois do React re-renderizar.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      if (hasSelection) el.setSelectionRange(from, from + converted.length);
    });
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5">
      <div className="flex flex-wrap gap-1.5">
        {TEXT_CASE_OPTIONS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(id)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 transition-colors hover:border-violet-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">{t('notebook.case.hint')}</p>
    </div>
  );
}
