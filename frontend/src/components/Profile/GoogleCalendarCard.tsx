import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, CheckIcon } from '../UI/Icons';
import DisconnectCalendarModal from './DisconnectCalendarModal';
import { disconnectGoogleCalendar } from '../../api/calendarService';
import { refreshCalendarStatus, useCalendarStatus } from '../../hooks/useCalendarStatus';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function GoogleCalendarCard() {
  // Usa a mesma cache partilhada do CalendarSyncButton/TaskFormFields -
  // antes este componente fazia o seu próprio getCalendarStatus() direto,
  // o que duplicava o GET /calendar/status sempre que o Profile abria (a
  // resposta nem sequer alimentava a cache dos outros componentes) e não
  // atualizava se outro componente chamasse refreshCalendarStatus().
  const connected = useCalendarStatus();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);
    try {
      await disconnectGoogleCalendar();
      // Invalida a cache partilhada e avisa já todos os componentes
      // montados (Dashboard incluído) - não é preciso reload nenhum.
      refreshCalendarStatus();
      setIsConfirmOpen(false);
    } catch {
      setError('Could not disconnect Google Calendar. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-3xl mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <CalendarIcon className="text-violet-400" width={18} height={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-100">Google Calendar</h3>
            <p className="text-sm text-neutral-400 mt-0.5">
              {connected === null
                ? 'Checking connection...'
                : connected
                  ? 'Connected. Sync tasks as events from the Dashboard.'
                  : 'Connect your Google account to sync tasks as calendar events.'}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-3 sm:pl-4">
          {connected === true && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded-full px-2.5 py-1">
              <CheckIcon width={12} height={12} /> Connected
            </span>
          )}

          {connected === false && (
            <a
              href={`${apiUrl}/auth/google/link-calendar`}
              className="w-full sm:w-auto text-center rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Connect
            </a>
          )}

          {connected === true && (
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="rounded-lg border border-neutral-700 text-neutral-400 hover:border-red-800 hover:text-red-400 text-sm font-medium px-4 py-2 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Aviso de privacidade in-product (a Google exige que seja visivel junto
          ao pedido de acesso, e que o link seja o mesmo do ecra de consentimento). */}
      <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
        Connecting asks Google for one permission, <code>calendar.events</code>. We only create,
        update and delete the events this app itself creates in your primary calendar, and only
        after you confirm a preview. We never read your other events, and you can disconnect or
        remove the synced events at any time. See our{' '}
        <Link to="/privacy" className="underline text-violet-400 hover:text-violet-300">
          Privacy Policy
        </Link>
        . Use of information received from Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
          className="underline text-violet-400 hover:text-violet-300"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      {isConfirmOpen && (
        <DisconnectCalendarModal
          isDisconnecting={isDisconnecting}
          error={error}
          onCancel={() => (isDisconnecting ? undefined : setIsConfirmOpen(false))}
          onConfirm={handleDisconnect}
        />
      )}
    </div>
  );
}
