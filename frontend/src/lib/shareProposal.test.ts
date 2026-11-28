import { describe, expect, it } from 'vitest';
import { proposalChanges } from './shareProposal';

describe('proposalChanges', () => {
  it('nada muda quando o proposto e igual ou nao vem', () => {
    expect(proposalChanges({}, 'a', 'b')).toEqual({ titleChanged: false, textChanged: false, delta: '+0' });
    expect(proposalChanges({ title: 'a', textContent: 'b' }, 'a', 'b').textChanged).toBe(false);
  });
  it('assinala titulo e texto, com sinal na diferenca', () => {
    expect(proposalChanges({ title: 'x', textContent: 'abc' }, 'a', 'a')).toEqual({
      titleChanged: true,
      textChanged: true,
      delta: '+2',
    });
    expect(proposalChanges({ textContent: '' }, 'a', 'abc').delta).toBe('-3');
  });
});
