import { type ReactNode, useEffect } from 'react';
import { XIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  // Largura maxima do painel; 'lg' e o formulario normal, 'wide' para previews.
  size?: ModalSize;
}

type ModalSize = 'lg' | 'wide';

const SIZE_CLASS: Record<ModalSize, string> = {
  lg: 'max-w-lg',
  wide: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, children, action, size = 'lg' }: ModalProps) {
  const { t } = useI18n();
  
  // Só ativa o listener se o Modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // Clicar no fundo escuro fecha o Modal
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Evitamos que o clique no formulário feche o Modal acidentalmente */}
      <div 
        className={`bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full ${SIZE_CLASS[size]} overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <div className="flex items-center gap-2">
            {action}
            <button 
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors p-1"
              title={t('common.close')}
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Corpo do Modal (Scrollable) */}
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}