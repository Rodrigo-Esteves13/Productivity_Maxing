import { useEffect, useState, type SyntheticEvent } from 'react';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import FormError from '../UI/FormError';
import ActionButton from '../UI/ActionButton';
import Button from '../UI/Button';
import LoadingState from '../UI/LoadingState';
import { useBannedIps } from '../../hooks/useBannedIps';

interface BannedIpsCardProps {
  // Preenchido pelo botão "Ban" numa linha da tabela de logs (ver
  // Security.tsx) - este componente só lê o valor para inicializar o
  // campo; depois disso o campo tem vida própria (o user pode continuar
  // a editar antes de confirmar).
  prefillIp: string;
}

export default function BannedIpsCard({ prefillIp }: BannedIpsCardProps) {
  const { bannedIps, isLoading, error, isSubmitting, ban, unban } = useBannedIps();
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (prefillIp) setIp(prefillIp);
  }, [prefillIp]);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const success = await ban(ip.trim(), reason.trim() || undefined);
    if (success) {
      setIp('');
      setReason('');
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-white mb-1">Banned IPs</h2>
      <p className="text-sm text-neutral-400 mb-4">
        A banned IP gets a flat 403 on every request, before rate limiting or anything else runs.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
        <FormField label="IP address" htmlFor="ban-ip" className="flex-1">
          <Input
            id="ban-ip"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="203.0.113.42"
            required
          />
        </FormField>
        <FormField label="Reason (optional)" htmlFor="ban-reason" className="flex-1">
          <Input
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this IP being banned?"
            maxLength={500}
          />
        </FormField>
        <div className="flex items-end">
          <ActionButton type="submit" color="amber" disabled={isSubmitting || !ip.trim()}>
            {isSubmitting ? 'Banning...' : 'Ban IP'}
          </ActionButton>
        </div>
      </form>

      {error && <div className="mb-4"><FormError message={error} /></div>}

      {isLoading ? (
        <LoadingState message="Loading banned IPs..." />
      ) : bannedIps.length === 0 ? (
        <p className="text-sm text-neutral-500">No IPs banned right now.</p>
      ) : (
        <div className="space-y-2">
          {bannedIps.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 bg-neutral-800/60 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-neutral-200">{b.ip}</p>
                {b.reason && (
                  <p className="text-xs text-neutral-500 truncate" title={b.reason}>
                    {b.reason}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void unban(b.id)}
                className="w-auto px-3 py-1.5 text-xs shrink-0"
              >
                Unban
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
