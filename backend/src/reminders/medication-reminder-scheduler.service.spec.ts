import {
  MEDICATION_SCHEDULER_DISABLED_ENV,
  MedicationReminderSchedulerService,
} from './medication-reminder-scheduler.service';
import type { MedicationsService } from '../wellbeing/medications.service';

function setup(sendDueReminders: jest.Mock) {
  const medications = { sendDueReminders } as unknown as MedicationsService;
  return new MedicationReminderSchedulerService(medications);
}

describe('MedicationReminderSchedulerService', () => {
  afterEach(() => {
    delete process.env[MEDICATION_SCHEDULER_DISABLED_ENV];
  });

  it('sends the due medication reminders and returns how many users', async () => {
    const send = jest.fn().mockResolvedValue(2);
    expect(await setup(send).tick()).toBe(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled by env', async () => {
    process.env[MEDICATION_SCHEDULER_DISABLED_ENV] = 'true';
    const send = jest.fn();
    expect(await setup(send).tick()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('never overlaps with a run that is still going', async () => {
    let release: (n: number) => void = () => undefined;
    const send = jest.fn(
      () => new Promise<number>((resolve) => (release = resolve)),
    );
    const scheduler = setup(send);
    const first = scheduler.tick();
    expect(await scheduler.tick()).toBe(0);
    release(1);
    expect(await first).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('swallows errors so the next minute can try again', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(1);
    const scheduler = setup(send);
    expect(await scheduler.tick()).toBe(0);
    expect(await scheduler.tick()).toBe(1);
  });
});
