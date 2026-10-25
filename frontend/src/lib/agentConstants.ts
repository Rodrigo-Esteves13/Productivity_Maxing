// Caminho do .exe "vanilla" do pmaxing-agent, servido como ficheiro estático
// pelo Netlify a partir de public/downloads/. Usado tanto pelo link de
// download manual (SetupInstructions.tsx) como pelo download "pre-configurado
// num clique" (DownloadSetupButton.tsx, que busca este mesmo ficheiro por
// fetch() e cola a API key ao fim antes de o entregar ao browser). Um único
// sítio para este caminho evita que os dois ficheiros divirjam se o .exe
// alguma vez mudar de nome ou de pasta.
export const AGENT_EXE_DOWNLOAD_PATH = '/downloads/pmaxing-agent.exe';

// Marcadores da config embutida no .exe. TÊM de ser byte-a-byte idênticos aos
// de agent/internal/config/embedded.go - se um dos lados mudar, o outro tem
// de mudar também.
export const AGENT_EMBED_MARKER_START = '\n#--PMAXING-AGENT-EMBEDDED-CONFIG-V2-START--#\n';
export const AGENT_EMBED_MARKER_END = '\n#--PMAXING-AGENT-EMBEDDED-CONFIG-V2-END--#\n';

// O .exe vanilla tem a string do marcador no próprio código compilado. Se não a
// tiver, é um binário antigo que nunca vai ler a key anexada (E-04): melhor
// falhar antes de criar uma API key que ficaria órfã.
export function exeSupportsEmbeddedConfig(exeBytes: ArrayBuffer): boolean {
  const needle = AGENT_EMBED_MARKER_START.trim();
  return new TextDecoder('latin1').decode(exeBytes).includes(needle);
}
