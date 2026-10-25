import { describe, expect, it } from 'vitest';
import { AGENT_EMBED_MARKER_START, exeSupportsEmbeddedConfig } from './agentConstants';

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('exeSupportsEmbeddedConfig (E-04)', () => {
  it('accepts a binary that contains the current marker string', () => {
    expect(exeSupportsEmbeddedConfig(bytes(`MZ...${AGENT_EMBED_MARKER_START}...`))).toBe(true);
  });

  it('rejects an old binary that only knows the V1 marker', () => {
    expect(
      exeSupportsEmbeddedConfig(bytes('MZ...#--PMAXING-AGENT-EMBEDDED-CONFIG-V1-START--#...')),
    ).toBe(false);
  });
});
