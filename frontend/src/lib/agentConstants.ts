// Caminho do .exe "vanilla" do pmaxing-agent, servido como ficheiro estático
// pelo Netlify a partir de public/downloads/. Usado tanto pelo link de
// download manual (SetupInstructions.tsx) como pelo download "pre-configurado
// num clique" (DownloadSetupButton.tsx, que busca este mesmo ficheiro por
// fetch() e cola a API key ao fim antes de o entregar ao browser). Um único
// sítio para este caminho evita que os dois ficheiros divirjam se o .exe
// alguma vez mudar de nome ou de pasta.
export const AGENT_EXE_DOWNLOAD_PATH = '/downloads/pmaxing-agent.exe';
