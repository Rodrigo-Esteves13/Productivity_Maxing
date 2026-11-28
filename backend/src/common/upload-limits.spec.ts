import {
  ATTACHMENT_MAX_SIZE_BYTES,
  UPLOADS_PER_MINUTE,
  singleFileUpload,
} from './upload-limits';

describe('upload-limits', () => {
  it('singleFileUpload devolve um interceptor (mixin) utilizavel', () => {
    const Interceptor = singleFileUpload('file', ATTACHMENT_MAX_SIZE_BYTES);
    expect(typeof Interceptor).toBe('function');
  });

  it('constantes de upload sao positivas', () => {
    expect(ATTACHMENT_MAX_SIZE_BYTES).toBeGreaterThan(0);
    expect(UPLOADS_PER_MINUTE).toBeGreaterThan(0);
  });
});
