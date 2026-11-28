import Button from '../UI/Button';
import AccountBlockedHero from './AccountBlockedHero';
import AccountBlockedDetails from './AccountBlockedDetails';
import { useAccountBlocked } from './useAccountBlocked';
import { useI18n } from '../../i18n/useI18n';

interface AccountBlockedPageProps {
  // Só vem preenchido no caso "bloqueado logo no login" (ver Login.tsx) -
  // não existe cookie de sessão nesse caso, este token de 15 min é o que
  // autentica os pedidos abaixo em vez dele (ver JwtBlockedAwareStrategy
  // no backend). Quando undefined (caso "bloqueado a meio de uma sessão",
  // ver AccountBlockedGate.tsx), o cookie normal resolve sozinho.
  bearerToken?: string;
  // Mensagem curta já disponível de imediato (vem do próprio erro que
  // disparou este ecrã) - mostrada enquanto o fetch de baixo carrega os
  // detalhes completos, para o ecrã nunca ficar em branco.
  initialMessage?: string;
}

export default function AccountBlockedPage({
  bearerToken,
  initialMessage,
}: AccountBlockedPageProps) {
  const { t } = useI18n();
  const {
    load,
    message,
    setMessage,
    submitting,
    submitError,
    justSubmittedAt,
    fetchStatus,
    handleSubmit,
    handleLogout,
  } = useAccountBlocked(bearerToken);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <AccountBlockedHero load={load} />

      {/* Corpo - mesma largura de leitura confortável de um formulário
          normal da app, só que agora claramente separado da faixa de
          cima em vez de tudo espremido num único bloco centrado. */}
      <div className="flex-1 flex justify-center px-6 py-10">
        <div className="max-w-lg w-full">
          {load.status === 'loading' && (
            <p className="text-center text-neutral-400">
              {initialMessage ?? t('ui.loadingDetails')}
            </p>
          )}

          {load.status === 'error' && (
            <div className="text-center">
              <p className="text-neutral-400 mb-6">
                {initialMessage ??
                  t('ui.yourAccountHasBeenRestricted')}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={fetchStatus}>
                  {t('ui.tryAgain')}
                </Button>
                <Button onClick={handleLogout}>{t('ui.logOut')}</Button>
              </div>
            </div>
          )}

          {load.status === 'loaded' && load.data.status === 'ACTIVE' && (
            <div className="text-center">
              <p className="text-neutral-400 mb-6">
                {t('ui.yourAccountStatusHasChanged')}
              </p>
              <Button onClick={() => window.location.reload()}>{t('ui.reload')}</Button>
            </div>
          )}

          {load.status === 'loaded' && load.data.status !== 'ACTIVE' && (
            <AccountBlockedDetails
              data={load.data}
              message={message}
              setMessage={setMessage}
              submitting={submitting}
              submitError={submitError}
              justSubmittedAt={justSubmittedAt}
              onSubmit={handleSubmit}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>
    </div>
  );
}
