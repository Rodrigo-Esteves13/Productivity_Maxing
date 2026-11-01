import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { XIcon } from './Icons';
import IconButton from './IconButton';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

export default function Modal({ isOpen, onClose, title, children, action, size = 'lg' }: ModalProps) {
  const { t } = useI18n();
  const { mounted, state } = usePresence(isOpen, MODAL_EXIT_MS);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Guarda o elemento que abriu o Modal (ainda em foco durante o render, antes
  // de qualquer autoFocus dos filhos) para lhe devolver o foco ao fechar.
  const [wasOpen, setWasOpen] = useState(false);
  const [trigger, setTrigger] = useState<Element | null>(null);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setTrigger(document.activeElement);
  }

  // Só ativa o listener se o Modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Foco para dentro ao abrir (sem roubar o de um autoFocus dos filhos) e de
  // volta ao gatilho ao fechar.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      (bodyRef.current ? focusableIn(bodyRef.current)[0] : undefined)?.focus();
      if (!dialog.contains(document.activeElement)) dialog.focus();
    }
    return () => {
      const active = document.activeElement;
      const lost = !active || active === document.body || dialog?.contains(active);
      if (lost && trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [isOpen, trigger]);

  // Tab fica preso dentro do dialogo.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog || !(e.target instanceof Node) || !dialog.contains(e.target)) return;
    const items = focusableIn(dialog);
    if (items.length === 0) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  return (
    // Clicar no fundo escuro fecha o Modal
    <div
      data-state={state}
      className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Evitamos que o clique no formulário feche o Modal acidentalmente */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={state}
        className={`motion-modal bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full ${SIZE_CLASS[size]} overflow-hidden flex flex-col max-h-[90vh] outline-none`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 id={titleId} className="text-lg font-bold text-white">{title}</h2>
          <div className="flex items-center gap-2">
            {action}
            <IconButton label={t('common.close')} onClick={onClose} className="text-neutral-400">
              <XIcon />
            </IconButton>
          </div>
        </div>

        {/* Corpo do Modal (Scrollable) */}
        <div ref={bodyRef} className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
