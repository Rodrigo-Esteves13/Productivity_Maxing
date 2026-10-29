import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, CheckIcon } from '../UI/Icons';
import { syncTaskToCalendar, unsyncTaskFromCalendar } from '../../api/calendarService';
import { useCalendarStatus } from '../../hooks/useCalendarStatus';
import type { Task } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface CalendarSyncButtonProps {
  task: Task;
}

export default function CalendarSyncButton({ task }: CalendarSyncButtonProps) {
  const { t } = useI18n();
  const connected = useCalendarStatus();
  const [eventId, setEventId] = useState<string | null>(task.googleCalendarEventId);
  const [isLoading, setIsLoading] = useState(false);

  // A verificar se a conta Google está ligada - não mostra nada enquanto
  // não sabe, para o botão não "piscar" entre estados.
  if (connected === null) return null;

  if (!connected) {
    return (
      <Link
        to="/profile"
        title={t('ui.connectGoogleCalendarInYour')}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center text-neutral-500 hover:text-neutral-400 transition-colors"
      >
        <CalendarIcon width={14} height={14} />
      </Link>
    );
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (eventId) {
        await unsyncTaskFromCalendar(task.id);
        setEventId(null);
      } else {
        const res = await syncTaskToCalendar(task.id);
        setEventId(res.googleCalendarEventId);
      }
    } catch {
      // Falha silenciosa no botão - o erro fica no terminal do backend;
      // o utilizador só vê o botão a não mudar de estado.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      title={eventId ? t('ui.removeFromGoogleCalendar') : t('ui.addToGoogleCalendar')}
      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
        eventId
          ? 'border-cyan-800 text-cyan-400 bg-cyan-900/30'
          : 'border-neutral-700 text-neutral-400 hover:border-violet-700 hover:text-violet-300'
      }`}
    >
      {eventId ? <CheckIcon width={12} height={12} /> : <CalendarIcon width={12} height={12} />}
      {eventId ? t('ui.synced') : t('ui.sync')}
    </button>
  );
}
