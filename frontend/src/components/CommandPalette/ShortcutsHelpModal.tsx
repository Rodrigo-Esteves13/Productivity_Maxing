import type { ReactNode } from 'react';
import Modal from '../UI/Modal';
import { useI18n } from '../../i18n/useI18n';
import { GO_TARGETS, HELP_KEY, SEQUENCE_PREFIX } from '../../lib/shortcutSequence';
import { usePaletteShortcutsPref } from '../../hooks/usePaletteShortcutsPref';

const IS_MAC = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
const PALETTE_KEY = 'K';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block min-w-6 rounded border border-neutral-700 px-1.5 py-0.5 text-center text-xs text-neutral-300">
      {children}
    </kbd>
  );
}

function Row({ keys, label }: { keys: ReactNode; label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className="flex shrink-0 items-center gap-1">{keys}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      <ul className="divide-y divide-neutral-800">{children}</ul>
    </section>
  );
}

export default function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  const { t } = useI18n();
  const { enabled } = usePaletteShortcutsPref();
  const then = t('paletteShortcuts.then');
  // Cmd e igual em todas as linguas; Ctrl/Delete/Backspace seguem o teclado local.
  const modLabel = IS_MAC ? 'Cmd' : t('paletteShortcuts.key.ctrl');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('paletteShortcuts.title')}>
      <Section title={t('paletteShortcuts.general')}>
        <Row
          label={t('paletteShortcuts.openPalette')}
          keys={
            <>
              <Kbd>{modLabel}</Kbd>
              <Kbd>{PALETTE_KEY}</Kbd>
            </>
          }
        />
        {enabled && <Row label={t('paletteShortcuts.openHelp')} keys={<Kbd>{HELP_KEY}</Kbd>} />}
      </Section>

      {!enabled && <p className="mt-4 text-sm text-neutral-300">{t('paletteShortcuts.off')}</p>}

      {enabled && (
        <>
          <Section title={t('paletteShortcuts.goTo')}>
            {GO_TARGETS.map((target) => (
              <Row
                key={target.key}
                label={t(target.labelKey)}
                keys={
                  <>
                    <Kbd>{SEQUENCE_PREFIX}</Kbd>
                    <span className="text-xs text-neutral-500">{then}</span>
                    <Kbd>{target.key}</Kbd>
                  </>
                }
              />
            ))}
          </Section>

          <Section title={t('paletteShortcuts.tasksPage')}>
            <Row label={t('paletteShortcuts.task.new')} keys={<Kbd>n</Kbd>} />
            <Row label={t('paletteShortcuts.task.complete')} keys={<Kbd>c</Kbd>} />
            <Row label={t('paletteShortcuts.task.edit')} keys={<Kbd>e</Kbd>} />
            <Row
              label={t('paletteShortcuts.task.delete')}
              keys={
                <>
                  <Kbd>{t('paletteShortcuts.key.delete')}</Kbd>
                  <span className="text-xs text-neutral-500">/</span>
                  <Kbd>{t('paletteShortcuts.key.backspace')}</Kbd>
                </>
              }
            />
          </Section>

          <p className="mt-4 text-xs text-neutral-500">{t('paletteShortcuts.note')}</p>
        </>
      )}
    </Modal>
  );
}
