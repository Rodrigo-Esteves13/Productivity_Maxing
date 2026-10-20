import { CheckIcon, XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface AttendanceToggleProps {
  subject: string;
  attended: boolean | null | undefined;
  onChange: (attended: boolean | null) => void;
}

const OPTIONS = [
  {
    value: true,
    labelKey: 'attendance.present',
    Icon: CheckIcon,
    activeClass: 'border-violet-500 bg-violet-600 text-white',
  },
  {
    value: false,
    labelKey: 'attendance.absent',
    Icon: XIcon,
    activeClass: 'border-red-700 bg-red-900/70 text-red-100',
  },
] as const;

// Dois botoes so com icone (a grelha de 7 colunas nao tem largura para
// texto): fui / faltei. Carregar no que ja esta ativo limpa a marcacao.
export default function AttendanceToggle({ subject, attended, onChange }: AttendanceToggleProps) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t('attendance.groupLabel', { subject })} className="mt-1 flex gap-1">
      {OPTIONS.map(({ value, labelKey, Icon, activeClass }) => {
        const pressed = attended === value;
        return (
          <button
            key={labelKey}
            type="button"
            aria-pressed={pressed}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => onChange(pressed ? null : value)}
            className={`flex h-6 w-6 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              pressed ? activeClass : 'border-neutral-700 text-neutral-500 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
