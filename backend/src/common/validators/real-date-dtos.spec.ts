import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateBloodDonationDto,
  UpdateBloodDonationDto,
} from '../../wellbeing/dto/blood-donation.dto';
import {
  DateKeyParamDto,
  MoodRangeQueryDto,
} from '../../wellbeing/dto/mood.dto';
import { CopyWeekDto } from '../../work-shifts/dto/copy-week.dto';
import { CreateStreakFreezeDto } from '../../study-sessions/dto/create-streak-freeze.dto';
import {
  CreateClassDto,
  UpdateClassDto,
} from '../../schedule/dto/class-input.dto';
import {
  CreateFeedbackDto,
  UpdateOwnFeedbackDto,
} from '../../feedback/dto/create-feedback.dto';

// Datas que a regex YYYY-MM-DD deixava passar: 2026-02-31 virava 3 de marco
// e 2026-13-01 dava uma Date invalida (500 no Prisma).
const IMPOSSIBLE_DATES = ['2026-02-31', '2026-13-01', '2026-00-10'];

async function errorsOn(
  cls: new () => object,
  body: Record<string, unknown>,
  field: string,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors
    .filter((e) => e.property === field)
    .flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('date DTOs reject impossible calendar dates', () => {
  const cases: [string, new () => object, string][] = [
    ['UpdateBloodDonationDto', UpdateBloodDonationDto, 'date'],
    ['CreateBloodDonationDto', CreateBloodDonationDto, 'date'],
    ['DateKeyParamDto', DateKeyParamDto, 'date'],
    ['MoodRangeQueryDto', MoodRangeQueryDto, 'from'],
  ];

  it.each(cases)('%s', async (_name, cls, field) => {
    for (const date of IMPOSSIBLE_DATES) {
      expect(await errorsOn(cls, { [field]: date }, field)).toContain(
        'isRealDateKey',
      );
    }
    expect(await errorsOn(cls, { [field]: '2026-02-28' }, field)).toEqual([]);
  });

  it('CopyWeekDto and CreateStreakFreezeDto also check the calendar', async () => {
    const copy = await validate(
      plainToInstance(CopyWeekDto, { fromWeekStart: '2026-02-31' }),
    );
    expect(
      copy.some((e) =>
        Object.keys(e.constraints ?? {}).includes('isRealDateKey'),
      ),
    ).toBe(true);
    const freeze = await validate(
      plainToInstance(CreateStreakFreezeDto, { dateKey: '2026-13-01' }),
    );
    expect(
      freeze.some((e) =>
        Object.keys(e.constraints ?? {}).includes('isRealDateKey'),
      ),
    ).toBe(true);
  });
});

describe('text DTOs validate the trimmed value', () => {
  it('a class subject made of spaces is rejected', async () => {
    const body = { date: '2026-09-14', startMinutes: 60, endMinutes: 120 };
    expect(
      await errorsOn(CreateClassDto, { ...body, subject: '   ' }, 'subject'),
    ).toContain('isNotEmpty');
    expect(
      await errorsOn(UpdateClassDto, { subject: '   ' }, 'subject'),
    ).toContain('isNotEmpty');
    const ok = plainToInstance(CreateClassDto, {
      ...body,
      subject: '  Redes ',
    });
    expect(ok.subject).toBe('Redes');
  });

  it('a feedback message made of spaces is rejected', async () => {
    expect(
      await errorsOn(UpdateOwnFeedbackDto, { message: '      ' }, 'message'),
    ).toContain('minLength');
    expect(
      await errorsOn(
        CreateFeedbackDto,
        { category: 'BUG', message: '  a  ' },
        'message',
      ),
    ).toContain('minLength');
  });
});
