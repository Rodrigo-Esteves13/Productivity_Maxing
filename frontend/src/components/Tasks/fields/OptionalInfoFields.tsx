import Input from '../../UI/Input';

interface OptionalInfoFieldsProps {
  topics: string;
  referenceLink: string;
  onTopicsChange: (value: string) => void;
  onReferenceLinkChange: (value: string) => void;
  calendarConnected: boolean;
  syncToCalendar: boolean;
  onSyncToCalendarChange: (value: boolean) => void;
  calendarTime: string;
  onCalendarTimeChange: (value: string) => void;
  calendarDurationMinutes: string;
  onCalendarDurationMinutesChange: (value: string) => void;
}

// Regras de validação (espelhadas no backend, create-task.dto.ts):
// mínimo 5 minutos, máximo 30 dias. Sem limite ao fim do dia - um evento
// com hora pode perfeitamente atravessar a meia-noite (ex: 23h + 3h de
// duração acaba às 2h do dia seguinte) ou durar vários dias (ex: uma
// viagem, um hackathon); o CalendarService já lida com isso sozinho,
// porque a hora de fim é sempre start + duração em minutos, sem qualquer
// lógica especial de "dia".
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 30 * 24 * 60;

// Só para o texto de apoio ao lado do input - nunca é o que é gravado.
function formatDurationHint(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}min`);
  return parts.length ? parts.join(' ') : '0min';
}

export default function OptionalInfoFields({
  topics,
  referenceLink,
  onTopicsChange,
  onReferenceLinkChange,
  calendarConnected,
  syncToCalendar,
  onSyncToCalendarChange,
  calendarTime,
  onCalendarTimeChange,
  calendarDurationMinutes,
  onCalendarDurationMinutesChange,
}: OptionalInfoFieldsProps) {
  const showTimeField = calendarConnected && syncToCalendar;
  // A duração só faz sentido quando o evento tem mesmo uma hora de início -
  // um evento "dia inteiro" não tem hora de fim para calcular.
  const showDurationField = showTimeField && !!calendarTime;

  return (
    <div className="space-y-4 pt-4 border-t border-neutral-800">
      <p className="text-xs font-semibold text-neutral-500 uppercase">Optional Information</p>
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Topics"
          value={topics}
          onChange={(e) => onTopicsChange(e.target.value)}
          className="w-full"
        />
        <Input
          type="url"
          placeholder="Reference link"
          value={referenceLink}
          onChange={(e) => onReferenceLinkChange(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex items-start gap-2 pt-1">
        <input
          type="checkbox"
          id="sync-to-calendar"
          checked={calendarConnected && syncToCalendar}
          disabled={!calendarConnected}
          onChange={(e) => onSyncToCalendarChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-violet-600 disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <div className="flex-1">
          <label htmlFor="sync-to-calendar" className={calendarConnected ? 'cursor-pointer' : ''}>
            <span className="text-sm text-neutral-400">Add to Google Calendar</span>
            <p className="text-xs text-neutral-600">
              {calendarConnected
                ? 'Creates (or updates) an event for this task on save.'
                : 'Connect Google Calendar in your profile to enable this.'}
            </p>
          </label>

          {showTimeField && (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="sync-to-calendar-time" className="text-xs text-neutral-500">
                Time (optional)
              </label>
              <input
                id="sync-to-calendar-time"
                type="time"
                value={calendarTime}
                onChange={(e) => onCalendarTimeChange(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-600"
              />
              {showDurationField ? (
                <>
                  <input
                    id="sync-to-calendar-duration"
                    type="number"
                    inputMode="numeric"
                    min={MIN_DURATION_MINUTES}
                    max={MAX_DURATION_MINUTES}
                    step={5}
                    value={calendarDurationMinutes}
                    onChange={(e) => onCalendarDurationMinutesChange(e.target.value)}
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-600"
                  />
                  <span className="text-xs text-neutral-600">
                    min{' '}
                    {formatDurationHint(Number(calendarDurationMinutes)) &&
                      `(${formatDurationHint(Number(calendarDurationMinutes))})`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-neutral-600">Blank = all-day event.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
