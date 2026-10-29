import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Zonas frias (admin, auth, legal, landing, definições, rodapé): visitadas
// pouco e quase só formulários/texto. Ficam fora do React Compiler porque
// o código de memo que ele gera pesava 50-85% (gzip) a mais por chunk sem
// ganho que se note. O resto da app (Dashboard, Tasks, Focus, Schedule,
// Notebook, Social, Ctrl+K, UI partilhada, contexts, hooks) é compilado.
const COMPILER_COLD_PAGES = [
  'AdminUserProfile', 'Agent', 'Appeals', 'Changelog', 'Developer', 'DmcaPolicy', 'Eula',
  'FeedbackAdmin', 'ForgotPassword', 'FriendCodeRequestsAdmin', 'Home', 'Login', 'LoginTwoFactor',
  'NotFound', 'PrivacyPolicy', 'Profile', 'Register', 'ResetPassword', 'Security', 'TaskTypes',
  'TermsOfService', 'Users', 'VerifyEmail',
];
const COMPILER_COLD_COMPONENT_DIRS = [
  'AccountBlocked', 'Accessibility', 'Agent', 'Appeals', 'Auth', 'Developer', 'ErrorBoundary',
  'Feedback', 'Footer', 'Home', 'Legal', 'Maintenance', 'Priorities', 'Security', 'TaskTypes', 'Users',
];

// React Compiler (via Babel, só nos ficheiros com componentes/hooks):
// memoiza sozinho componentes e valores, para listas e páginas não
// voltarem a renderizar sem precisar. Componentes que quebram as regras
// do React são saltados pelo compilador (ficam como antes).
const reactCompiler = reactCompilerPreset();
reactCompiler.rolldown.filter = {
  ...reactCompiler.rolldown.filter,
  id: {
    exclude: [
      new RegExp(`[\\\\/]src[\\\\/]pages[\\\\/](${COMPILER_COLD_PAGES.join('|')})\\.tsx$`),
      new RegExp(`[\\\\/]src[\\\\/]components[\\\\/](${COMPILER_COLD_COMPONENT_DIRS.join('|')})[\\\\/]`),
      // Profile é só definições, mas o Avatar aparece na Navbar e nas listas de amigos.
      /[\\/]src[\\/]components[\\/]Profile[\\/](?!Avatar\.tsx$)/,
      /[\\/]src[\\/]pwa[\\/]/,
      // Cartões/gráficos de analítica do Dashboard (folhas, lazy): a página
      // compilada já os memoiza, não re-renderizam ao filtrar a tabela.
      // O TaskCard é uma linha da lista e fica compilado.
      /[\\/]src[\\/]components[\\/]Dashboard[\\/](?!TaskCard\.tsx$)\w+(Card|Chart)\.tsx$/,
    ],
  },
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompiler] }), tailwindcss(), VitePWA({
    // 'autoUpdate' -> o SW troca de versão sozinho no próximo load,
    // sem precisar de o user aceitar um prompt de "nova versão disponível".
    // Combinado com o registerSW.ts (que força skipWaiting), garante que
    // ninguém fica preso numa build antiga depois de um deploy.
    registerType: 'autoUpdate',
    // Regista o SW à mão em main.tsx via virtual:pwa-register, para termos
    // controlo sobre o momento e podermos mostrar UI de "atualização
    // aplicada" se algum dia quisermos.
    injectRegister: false,
    manifest: {
      name: 'Productivity Maxing',
      short_name: 'PMaxing',
      description: 'Gestão de tarefas académicas e produtividade pessoal.',
      theme_color: '#0d0920',
      // violet-500 (accent da marca)
      background_color: '#0d0920',
      // neutral-950 (fundo dark do tema)
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [{
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      }, {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }, {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }],
      // Toque longo (ou clique direito) no icone da app instalada. Os URLs
      // tem de bater com as rotas: /tasks?new=1 abre o formulario de criar
      // (ver NEW_TASK_PARAM em useTasksPage.ts).
      shortcuts: [{
        name: 'New task',
        url: '/tasks?new=1',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }, {
        name: 'Today',
        url: '/dashboard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }, {
        name: 'Schedule',
        url: '/schedule',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }, {
        name: 'Focus',
        url: '/focus',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }]
    },
    workbox: {
      importScripts: ['push-sw.js'],
      // Só JS/CSS/fontes/ícones do build entram no precache (imutáveis,
      // têm hash no nome). NUNCA HTML aqui - o index.html é sempre
      // pedido à rede para apanhar deploys novos (ver a regra de
      // navegação em runtimeCaching: rede primeiro, cache só offline).
      globPatterns: ['**/*.{js,css,woff2,png,svg,ico}'],
      navigateFallback: null,
      runtimeCaching: [
      // Qualquer chamada à API (domínio separado em produção,
      // api.pmaxing.pt) NUNCA é cacheada - dados de utilizador,
      // sessão, CSRF. NetworkOnly = passa sempre pelo SW sem tocar
      // em cache nenhuma.
      {
        urlPattern: ({
          url
        }) => url.pathname.startsWith('/auth/') || url.pathname.startsWith('/agent/') || url.hostname === 'api.pmaxing.pt' || url.hostname === 'localhost',
        handler: 'NetworkOnly'
      },
      // Navegações da própria app (abrir/recarregar uma página): rede
      // PRIMEIRO, para apanhar sempre o index.html de um deploy novo. Só
      // sem rede é que serve a última cópia guardada, para a PWA instalada
      // abrir offline (com o OfflineBanner) em vez da página de erro do
      // browser (F-10). Sem networkTimeoutSeconds de propósito: uma rede
      // lenta continua a ir à rede. Todas as rotas guardam-se na mesma
      // chave ('/'), porque o Netlify serve o mesmo index.html para todas
      // (_redirects) e assim qualquer rota abre offline. Só HTML da app
      // (sem dados de utilizador): a API está noutro domínio e /auth/ é
      // apanhado antes pela regra NetworkOnly acima.
      {
        // Inline de propósito: esta função é copiada para o sw.js, não
        // pode usar constantes deste ficheiro. /privacy e /terms são HTML
        // estático próprio (_redirects), não o index.html da app.
        urlPattern: ({
          request,
          url,
          sameOrigin
        }) => sameOrigin && request.mode === 'navigate' && !/^\/(privacy|terms)(\/|$)/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pmaxing-app-shell',
          cacheableResponse: {
            statuses: [200]
          },
          expiration: {
            maxEntries: 1
          },
          plugins: [{
            cacheKeyWillBeUsed: async () => '/'
          }]
        }
      },
      // Ícones/imagens estáticas servidas pelo Netlify: podem ser
      // cache-first agressivo, mudam raramente.
      {
        urlPattern: ({
          request,
          url
        }) => request.destination === 'image' && url.pathname.startsWith('/icons/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'pmaxing-icons',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
          }
        }
      }],
      // Limpa caches de builds anteriores automaticamente.
      cleanupOutdatedCaches: true
    },
    devOptions: {
      // Não ativar o SW em `npm run dev` - só queremos isto testado
      // em build/preview, para não andar a debugar cache no HMR.
      enabled: false
    }
  })],
  build: {
    chunkSizeWarningLimit: 1500,
    // 'hidden': gera os .map normalmente (útil para dar deobfuscate a um
    // stack trace que caia no ErrorBoundary/telemetry), mas NÃO injeta o
    // comentário `//# sourceMappingURL=` no JS servido - um visitante a
    // abrir o DevTools não vê o teu código-fonte original, só o bundle
    // minificado. Os .map ficam no output do build (dist/assets/*.map);
    // não são publicados automaticamente só por existirem, mas confirma
    // que o Netlify não os está a servir publicamente (não deviam estar
    // referenciados por nada, logo ninguém os encontra por engano, mas
   
    // vale a pena um Disallow: /**/*.map no robots.txt se quiseres reforçar).
    sourcemap: 'hidden'
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 300
    }
  }
});
