import { redactSecretPath } from './redact-secret-path.util';

describe('redactSecretPath', () => {
  it('redacts the calendar feed token', () => {
    expect(redactSecretPath('/feed/abc123.ics')).toBe('/feed/[redacted]');
  });

  it('redacts a notebook share token, keeping the rest of the path', () => {
    expect(redactSecretPath('/notebook/shared/tok_123/request-access')).toBe(
      '/notebook/shared/[redacted]/request-access',
    );
    expect(redactSecretPath('/notebook/shared/tok_123?x=1')).toBe(
      '/notebook/shared/[redacted]?x=1',
    );
  });

  it('keeps the literal with-me route readable', () => {
    expect(redactSecretPath('/notebook/shared/with-me')).toBe(
      '/notebook/shared/with-me',
    );
  });

  it('redacts a task pack code', () => {
    expect(redactSecretPath('/task-packs/code/Xy9_k/import')).toBe(
      '/task-packs/code/[redacted]/import',
    );
  });

  it('leaves paths without secrets untouched', () => {
    expect(redactSecretPath('/tasks/123')).toBe('/tasks/123');
  });
});
