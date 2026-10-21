import { Logger } from '@nestjs/common';
import { runInBackground } from './background.util';

describe('runInBackground', () => {
  it('logs a failure instead of throwing', async () => {
    const error = jest.fn();
    const logger = { error } as unknown as Logger;
    runInBackground(Promise.reject(new Error('smtp down')), logger, 'Email');
    await new Promise((resolve) => setImmediate(resolve));
    expect(error).toHaveBeenCalledWith('Email failed: smtp down');
  });
});
