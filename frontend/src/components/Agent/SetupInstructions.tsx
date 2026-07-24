import { DownloadIcon } from '../UI/Icons';
import DownloadSetupButton from './DownloadSetupButton';
import { AGENT_EXE_DOWNLOAD_PATH } from '../../lib/agentConstants';

// href aponta para o binário VANILLA (sem key nenhuma) servido a partir de
// public/downloads/ - ver AGENT_EXE_DOWNLOAD_PATH em lib/agentConstants.ts,
// a mesma constante usada pelo DownloadSetupButton para buscar este ficheiro
// por fetch() e colar a key ao fim antes do download.
// Build: GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -H=windowsgui"
// -H=windowsgui é importante: sem isso volta a abrir uma janela de
// consola preta ao correr.
const DOWNLOAD_URL = AGENT_EXE_DOWNLOAD_PATH;

export default function SetupInstructions() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        The agent is a small program that runs on your Windows machine in the background, checks
        your pending tasks periodically, and blocks distracting apps and sites when the rules
        below say it should.
      </p>

      <DownloadSetupButton />

      <ol className="space-y-3 text-sm text-neutral-300 list-decimal list-inside">
        <li>Download the .exe above - it already has your API key baked in, nothing else to do.</li>
        <li>Double-click it. Windows will ask for administrator permission (needed to block sites). Click Yes.</li>
        <li>That's it. No terminal, no typing. It runs silently in the background from now on.</li>
        <li>
          Edit what and when it blocks any time in the sections below - the running agent picks
          up changes automatically, no restart needed.
        </li>
      </ol>

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer hover:text-neutral-300 transition-colors">
          Prefer the command line, or something went wrong?
        </summary>
        <div className="mt-3 space-y-3 pl-1">
          <p>
            You can download the plain .exe (no key baked in) and set the key yourself instead -
            generate one in <span className="text-neutral-300">Manage API keys</span> below, then
            run:
          </p>
          <a
            href={DOWNLOAD_URL}
            download
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-white transition-colors"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            Download pmaxing-agent.exe (plain)
          </a>
          <pre className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 overflow-x-auto">
            {'pmaxing-agent.exe -set-key PASTE_YOUR_KEY_HERE'}
          </pre>
          <p>
            To see live logs instead of the background log file (kept at{' '}
            <code className="text-violet-300 bg-neutral-900 px-1 rounded">
              %AppData%\PMaxingAgent\agent.log
            </code>
            ), run it from a terminal with:
          </p>
          <pre className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 overflow-x-auto">
            {'pmaxing-agent.exe -debug'}
          </pre>
        </div>
      </details>

      <p className="text-xs text-amber-400/80">
        This is friction against yourself, not a security boundary - a browser with DNS-over-HTTPS
        enabled can bypass the site blocking. It's meant to make it a little harder to give in to
        distraction, not to stop a determined attempt to get around it.
      </p>
    </div>
  );
}
