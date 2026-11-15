import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../../api/telemetryService';
import { clearStoredQuizSession } from '../../hooks/useQuizSession';
import { translateNow } from '../../i18n/translate';
import { telemetryUrl } from '../../lib/telemetryUrl';
import PageLayout from '../Layout/PageLayout';
import ErrorState from '../UI/ErrorState';

interface QuizErrorBoundaryProps {
  children: ReactNode;
}

interface QuizErrorBoundaryState {
  hasError: boolean;
  // Muda a cada recuperacao: remonta a pagina com o estado limpo.
  attempt: number;
}

// Rede de seguranca da pagina do quiz: se uma tentativa guardada rebentar a
// renderizacao, apaga-a do dispositivo (para nao voltar a rebentar) e mostra
// um erro com "tentar de novo", sem derrubar a app inteira.
export default class QuizErrorBoundary extends Component<QuizErrorBoundaryProps, QuizErrorBoundaryState> {
  state: QuizErrorBoundaryState = { hasError: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<QuizErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    clearStoredQuizSession();
    reportClientError({ message: error.message, stack: error.stack, componentStack: info.componentStack ?? undefined, url: telemetryUrl() });
  }

  reset = (): void => {
    clearStoredQuizSession();
    this.setState((prev) => ({ hasError: false, attempt: prev.attempt + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <PageLayout>
          <ErrorState message={translateNow('common.error.body')} onRetry={this.reset} />
        </PageLayout>
      );
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
