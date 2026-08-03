import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
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
      theme_color: '#a52ff0',
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
      }]
    },
    workbox: {
      // Só JS/CSS/fontes/ícones do build entram no precache (imutáveis,
      // têm hash no nome). NUNCA HTML aqui - o index.html é sempre
      // pedido à rede para apanhar deploys novos.
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
    chunkSizeWarningLimit: 1500
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 300
    }
  }
});