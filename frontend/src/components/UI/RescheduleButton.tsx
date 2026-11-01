import React from 'react';
import { useI18n } from '../../i18n/useI18n';

interface RescheduleButtonProps {
  isLoading: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export default function RescheduleButton({ isLoading, onClick, className = '' }: RescheduleButtonProps) {
  const { t } = useI18n();
  const idleLabel = t('common.plusOneDay');
  const busyLabel = t('ui.rescheduling');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      title={t('common.rescheduleTomorrow')}
      // before: alarga o alvo de toque para 40px de altura sem mudar o desenho.
      className={`relative inline-flex min-h-8 items-center justify-center leading-none px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-violet-400 hover:text-violet-300 hover:bg-violet-900/30 border border-transparent hover:border-violet-700 transition-colors duration-[var(--duration-quick)] ease-smooth-out before:absolute before:-inset-x-1 before:-inset-y-1 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0 ${className}`}
    >
      {/* Os dois textos ocupam a mesma celula: o botao tem sempre a largura do
          mais comprido e "A adiar..." nao empurra o que esta ao lado. */}
      <span className="grid text-center">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {busyLabel.length > idleLabel.length ? busyLabel : idleLabel}
        </span>
        <span className="col-start-1 row-start-1">{isLoading ? busyLabel : idleLabel}</span>
      </span>
    </button>
  );
}
