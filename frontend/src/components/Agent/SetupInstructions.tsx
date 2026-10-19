import { DownloadIcon } from '../UI/Icons';
import DownloadSetupButton from './DownloadSetupButton';
import CopyButton from '../UI/CopyButton';
import { AGENT_EXE_DOWNLOAD_PATH } from '../../lib/agentConstants';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';

// href aponta para o binário VANILLA (sem key nenhuma) servido a partir de
// public/downloads/ - ver AGENT_EXE_DOWNLOAD_PATH em lib/agentConstants.ts,
// a mesma constante usada pelo DownloadSetupButton para buscar este ficheiro
// por fetch() e colar a key ao fim antes do download.
// Build: GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -H=windowsgui"
// -H=windowsgui é importante: sem isso volta a abrir uma janela de
// consola preta ao correr.
const DOWNLOAD_URL = AGENT_EXE_DOWNLOAD_PATH;
const SET_KEY_COMMAND = 'pmaxing-agent.exe -set-key PASTE_YOUR_KEY_HERE';
const DEBUG_COMMAND = 'pmaxing-agent.exe -debug';

export default function SetupInstructions() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        {t('ui.theAgentIsASmall')}
      </p>

      <DownloadSetupButton />

      <ol className="space-y-3 text-sm text-neutral-300 list-decimal list-inside">
        <li>{t('ui.downloadTheExeAboveIt')}</li>
        <li>{t('ui.doubleClickItWindowsWill')}</li>
        <li>{t('ui.thatSItNoTerminal')}</li>
        <li>
          {t('ui.editWhatAndWhenIt')}
        </li>
      </ol>

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer hover:text-neutral-300 transition-colors">
          {t('ui.preferTheCommandLineOr')}
        </summary>
        <div className="mt-3 space-y-3 pl-1">
          <p>
            {fillNodes(t('ui.plainExeInstructions'), {
              keys: <span className="text-neutral-300">{t('ui.manageApiKeys')}</span>,
            })}
          </p>
          <a
            href={DOWNLOAD_URL}
            download
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-white transition-colors"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            {t('ui.downloadPmaxingAgentExePlain')}
          </a>
          <div className="flex items-start gap-2">
            <pre className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 overflow-x-auto">
              {SET_KEY_COMMAND}
            </pre>
            <CopyButton text={SET_KEY_COMMAND} label={t('ui.copy')} />
          </div>
          <p>
            {fillNodes(t('ui.liveLogsInstructions'), {
              path: (
                <code className="text-violet-300 bg-neutral-900 px-1 rounded">
                  {t('ui.appdataPmaxingagentAgentLog')}
                </code>
              ),
            })}
          </p>
          <div className="flex items-start gap-2">
            <pre className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 overflow-x-auto">
              {DEBUG_COMMAND}
            </pre>
            <CopyButton text={DEBUG_COMMAND} label={t('ui.copy')} />
          </div>
        </div>
      </details>

      <p className="text-xs text-amber-400/80">
        {t('ui.thisIsFrictionAgainstYourself')}
      </p>
    </div>
  );
}
