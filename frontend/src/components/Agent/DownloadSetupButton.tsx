import { useState } from 'react';
import { createApiKey } from '../../api/userService';
import { DownloadIcon } from '../UI/Icons';

// Setup num único clique: gera uma API key nova (nomeada automaticamente,
// ex: "agent-desktop-2026-07-16") e cola-a ao fim do .exe vanilla antes de
// disparar o download - o utilizador nunca vê nem copia a key à mão, e
// fica só com um ficheiro (não dois). Isto é complementar ao
// "Manage API keys" (que continua a viver em /developer para gestão/
// revoke) e ao download manual do .exe + "-set-key" (ver
// SetupInstructions), que continuam a existir como alternativa para quem
// preferir.
//
// Técnica: o Windows ignora dados anexados a seguir ao fim lógico de um
// .exe ao correr o binário, mas o próprio agente sabe procurar por esses
// bytes (ver internal/config/embedded.go no código do agente) - por
// isso basta concatenar [exe vanilla] + [marcador início] + [JSON com a
// key] + [marcador fim] num Blob e descarregar isso como o .exe final.
// Os marcadores TÊM de ser byte-a-byte idênticos aos definidos em
// embedded.go - se um dos lados mudar, o outro tem de mudar também.
const VANILLA_EXE_URL = '/downloads/pmaxing-agent.exe';
const MARKER_START = '\n#--PMAXING-AGENT-EMBEDDED-CONFIG-V1-START--#\n';
const MARKER_END = '\n#--PMAXING-AGENT-EMBEDDED-CONFIG-V1-END--#\n';

export default function DownloadSetupButton() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // Buscamos o .exe vanilla e criamos a key em paralelo - são
      // pedidos independentes.
      const [exeResponse, keyResult] = await Promise.all([
        fetch(VANILLA_EXE_URL),
        createApiKey(`agent-desktop-${new Date().toISOString().slice(0, 10)}`),
      ]);

      if (!exeResponse.ok) {
        throw new Error(`Failed to download base executable (HTTP ${exeResponse.status})`);
      }
      const exeBytes = await exeResponse.arrayBuffer();

      const configPayload = JSON.stringify({
        api: {
          // Nunca hardcoded: a mesma variável de ambiente que o resto da
          // app usa para falar com o backend (ver src/api/client.ts) -
          // assim o .exe gerado aponta sempre para o backend real desta
          // build do frontend (produção, staging, ou local), nunca para
          // um domínio fixo que ignora onde este site está mesmo a correr.
          baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
          apiKey: keyResult.apiKey,
        },
      });

      // Blob aceita uma lista de partes (ArrayBuffer/string/Blob) e
      // concatena-as pela ordem dada - o browser trata a codificação
      // UTF-8 das partes em string automaticamente.
      const finalBlob = new Blob([exeBytes, MARKER_START, configPayload, MARKER_END], {
        type: 'application/octet-stream',
      });

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pmaxing-agent.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Failed to generate pre-configured agent:', err);
      setError('Could not generate the pre-configured .exe. Try again, or set it up manually below.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        <DownloadIcon className="w-4 h-4" />
        {isGenerating ? 'Generating...' : 'Download pmaxing-agent.exe (pre-configured)'}
      </button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
