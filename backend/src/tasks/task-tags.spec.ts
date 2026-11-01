import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto } from './dto/create-task.dto';
import { normalizeTags, TAGS_MAX, TAG_LEN_MAX } from './task-tags';

describe('normalizeTags', () => {
  it('trims, lowercases, collapses spaces and dedupes', () => {
    expect(normalizeTags(['  Exam  Prep ', 'exam prep', 'LAB'])).toEqual([
      'exam prep',
      'lab',
    ]);
  });
  it('drops empty and non-string entries', () => {
    expect(normalizeTags(['', '   ', 'a', 5 as unknown as string])).toEqual([
      'a',
    ]);
  });
  it('caps length and count', () => {
    expect(normalizeTags(['x'.repeat(50)])[0]).toHaveLength(TAG_LEN_MAX);
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(TAGS_MAX);
  });
});

describe('CreateTaskDto tags', () => {
  const base = {
    areaId: 'a',
    title: 't',
    date: '2026-11-20T00:00:00Z',
    type: 'ACADEMICO',
    difficulty: 'EASY',
  };
  it('normalizes and validates', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      ...base,
      tags: [' A ', 'a', 'b'],
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.tags).toEqual(['a', 'b']);
  });
  it('rejects a non-array', async () => {
    const dto = plainToInstance(CreateTaskDto, { ...base, tags: 'x' });
    expect((await validate(dto)).map((e) => e.property)).toContain('tags');
  });
});
