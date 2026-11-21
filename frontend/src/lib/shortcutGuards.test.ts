import { describe, expect, it } from 'vitest';
import {
  hasBlockingModalOpen,
  hasShortcutsOffZone,
  isImeEvent,
  MODAL_DIALOG_SELECTOR,
  SHORTCUTS_OFF_PROPS,
  SHORTCUTS_OFF_SELECTOR,
  shouldIgnoreShortcut,
  type ShortcutKeyEvent,
} from './shortcutGuards';

interface FakeDialog {
  querySelector: (selector: string) => unknown;
}

// Raiz falsa: `dialogs` sao os modais abertos; `scoped` os que contem o marcador.
function root(opts: { dialogs?: number; scoped?: number; off?: boolean } = {}) {
  const { dialogs = 0, scoped = 0, off = false } = opts;
  const list: FakeDialog[] = Array.from({ length: dialogs }, (_, i) => ({
    querySelector: () => (i < scoped ? {} : null),
  }));
  return {
    querySelector: (selector: string) => (selector === SHORTCUTS_OFF_SELECTOR && off ? {} : null),
    querySelectorAll: (selector: string) => (selector === MODAL_DIALOG_SELECTOR ? list : []),
  };
}

const key = (over: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  key: 'n',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  keyCode: 78,
  defaultPrevented: false,
  target: { tagName: 'BODY' },
  ...over,
});

describe('modal selector', () => {
  it('only matches modal dialogs', () => {
    expect(MODAL_DIALOG_SELECTOR).toContain('[role="dialog"][aria-modal="true"]');
    expect(MODAL_DIALOG_SELECTOR).toContain('[role="alertdialog"][aria-modal="true"]');
  });

  it('exposes the shortcuts-off attribute for roots', () => {
    expect(SHORTCUTS_OFF_PROPS).toEqual({ 'data-shortcuts-off': '' });
    expect(SHORTCUTS_OFF_SELECTOR).toBe('[data-shortcuts-off]');
  });
});

describe('hasBlockingModalOpen', () => {
  it('is false with no modal and true with one', () => {
    expect(hasBlockingModalOpen(root())).toBe(false);
    expect(hasBlockingModalOpen(root({ dialogs: 1 }))).toBe(true);
  });

  it('lets the scoped dialog through but not another one on top of it', () => {
    const scope = '[data-x]';
    expect(hasBlockingModalOpen(root({ dialogs: 1, scoped: 1 }), scope)).toBe(false);
    expect(hasBlockingModalOpen(root({ dialogs: 2, scoped: 1 }), scope)).toBe(true);
    expect(hasBlockingModalOpen(root({ dialogs: 1, scoped: 0 }), scope)).toBe(true);
  });
});

describe('hasShortcutsOffZone', () => {
  it('detects a quiz or review root', () => {
    expect(hasShortcutsOffZone(root({ off: true }))).toBe(true);
    expect(hasShortcutsOffZone(root())).toBe(false);
  });
});

describe('isImeEvent', () => {
  it('catches composing and keyCode 229', () => {
    expect(isImeEvent({ isComposing: true, keyCode: 0 })).toBe(true);
    expect(isImeEvent({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeEvent({ isComposing: false, keyCode: 78 })).toBe(false);
  });
});

describe('shouldIgnoreShortcut', () => {
  it('lets a plain key on the page through', () => {
    expect(shouldIgnoreShortcut(key(), root())).toBe(false);
  });

  it('ignores modifiers, repeats, IME and handled events', () => {
    expect(shouldIgnoreShortcut(key({ ctrlKey: true }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ metaKey: true }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ altKey: true }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ repeat: true }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ isComposing: true }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ keyCode: 229 }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ defaultPrevented: true }), root())).toBe(true);
  });

  it('ignores typing in a text field but not on a checkbox', () => {
    expect(shouldIgnoreShortcut(key({ target: { tagName: 'INPUT', type: 'text' } }), root())).toBe(true);
    expect(shouldIgnoreShortcut(key({ target: { tagName: 'INPUT', type: 'checkbox' } }), root())).toBe(false);
  });

  it('ignores keys under a modal (help dialog) unless it is the allowed scope', () => {
    expect(shouldIgnoreShortcut(key(), root({ dialogs: 1 }))).toBe(true);
    expect(shouldIgnoreShortcut(key(), root({ dialogs: 1, scoped: 1 }), '[data-x]')).toBe(false);
    expect(shouldIgnoreShortcut(key(), root({ dialogs: 2, scoped: 1 }), '[data-x]')).toBe(true);
  });
});
