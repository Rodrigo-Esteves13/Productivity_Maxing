import { useEffect } from 'react';

const APP_NAME = 'Productivity Maxing';

// Define o título da tab do browser para a página atual.
// Uso: useDocumentTitle('Dashboard') -> tab fica "Dashboard · Productivity Maxing"
// Sem argumento -> tab fica só "Productivity Maxing" (usado no Login/Register).
export default function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}