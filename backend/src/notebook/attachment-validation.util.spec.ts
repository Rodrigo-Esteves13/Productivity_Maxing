import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { validateAttachmentUpload } from './attachment-validation.util';

// file-type e ESM puro e o jest nao o carrega.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const detect = jest.mocked(fileTypeFromBuffer);

const upload = (originalname: string, content: string | Buffer) =>
  validateAttachmentUpload({
    originalname,
    mimetype: 'text/html',
    buffer: Buffer.from(content),
  } as Express.Multer.File);

describe('validateAttachmentUpload', () => {
  beforeEach(() => detect.mockResolvedValue(undefined));

  it.each(['txt', 'py', 'md', 'json', 'csv'])(
    'stores .%s as text/plain, which the bucket accepts',
    async (ext) => {
      const result = await upload(`notes.${ext}`, 'hello');
      expect(result).toMatchObject({ ext, contentType: 'text/plain' });
    },
  );

  it('never stores HTML-looking text as text/html', async () => {
    const result = await upload('x.txt', '<script>alert(1)</script>');
    expect(result.contentType).toBe('text/plain');
  });

  it('stays text/plain when the detected type is not an allowed binary', async () => {
    detect.mockResolvedValue({ mime: 'application/xml', ext: 'xml' });
    const result = await upload('feed.md', '<?xml version="1.0"?>');
    expect(result.contentType).toBe('text/plain');
  });

  it('uses the detected MIME type for binary formats', async () => {
    detect.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
    const result = await upload('brief.txt', '%PDF-1.7');
    expect(result).toMatchObject({
      ext: 'pdf',
      contentType: 'application/pdf',
    });
  });

  it('rejects HTML files', async () => {
    await expect(upload('page.html', '<html></html>')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects binary content behind a text extension', async () => {
    await expect(
      upload('x.txt', Buffer.from([0x41, 0x00, 0x42])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
