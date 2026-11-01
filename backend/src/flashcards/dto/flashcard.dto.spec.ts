import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateFlashcardDto,
  ListFlashcardsQueryDto,
  ReviewFlashcardDto,
} from './flashcard.dto';
import { FLASHCARD_FRONT_MAX } from '../flashcards.constants';

const errs = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain))).length;

describe('flashcard DTOs', () => {
  it('accepts a valid card and trims', async () => {
    const dto = plainToInstance(CreateFlashcardDto, {
      front: ' a ',
      back: 'b',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.front).toBe('a');
  });

  it('rejects empty and oversize fields', async () => {
    expect(await errs(CreateFlashcardDto, { front: '  ', back: 'b' })).toBe(1);
    expect(
      await errs(CreateFlashcardDto, {
        front: 'x'.repeat(FLASHCARD_FRONT_MAX + 1),
        back: 'b',
      }),
    ).toBe(1);
  });

  it('rejects bad areaId and grade', async () => {
    expect(
      await errs(CreateFlashcardDto, { front: 'a', back: 'b', areaId: 'nope' }),
    ).toBe(1);
    expect(await errs(ReviewFlashcardDto, { grade: 'HARD' })).toBe(1);
    expect(await errs(ReviewFlashcardDto, { grade: 'GOOD' })).toBe(0);
  });

  it('parses dueOnly query string', () => {
    const q = plainToInstance(ListFlashcardsQueryDto, { dueOnly: 'true' });
    expect(q.dueOnly).toBe(true);
  });
});
