import { describe, expect, it } from 'vitest';
import { isTypingInFormField, type TypingTarget } from './isTypingInFormField';

const el = (over: TypingTarget): TypingTarget => ({ tagName: 'DIV', ...over });

describe('isTypingInFormField', () => {
  it('treats textarea, select and text-like inputs as typing', () => {
    expect(isTypingInFormField(el({ tagName: 'TEXTAREA' }))).toBe(true);
    expect(isTypingInFormField(el({ tagName: 'SELECT' }))).toBe(true);
    for (const type of ['text', 'search', 'email', 'password', 'number', 'url', 'tel', 'date', 'time']) {
      expect(isTypingInFormField(el({ tagName: 'INPUT', type }))).toBe(true);
    }
    expect(isTypingInFormField(el({ tagName: 'INPUT' }))).toBe(true);
  });

  it('ignores inputs that take no text', () => {
    for (const type of ['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color']) {
      expect(isTypingInFormField(el({ tagName: 'INPUT', type }))).toBe(false);
    }
  });

  it('covers contenteditable and textbox/combobox widgets', () => {
    expect(isTypingInFormField(el({ isContentEditable: true }))).toBe(true);
    expect(isTypingInFormField(el({ closest: () => ({}) }))).toBe(true);
    expect(isTypingInFormField(el({ closest: () => null }))).toBe(false);
  });

  it('is false for plain elements and non elements', () => {
    expect(isTypingInFormField(el({}))).toBe(false);
    expect(isTypingInFormField(null)).toBe(false);
    expect(isTypingInFormField({})).toBe(false);
  });
});
