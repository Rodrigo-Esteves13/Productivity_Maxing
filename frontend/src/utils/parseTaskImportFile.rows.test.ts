import { describe, expect, it } from 'vitest';
import { toSheetRowNumbers } from './parseTaskImportFile';

describe('toSheetRowNumbers (B-13)', () => {
  it('maps backend positions back to spreadsheet rows when earlier rows failed parsing', () => {
    // Sheet rows 1 and 3 parsed; row 2 failed and was not sent.
    const mapped = toSheetRowNumbers(
      [
        { row: 1, success: true },
        { row: 2, success: false, error: 'x' },
      ],
      [1, 3],
    );
    expect(mapped.map((r) => r.row)).toEqual([1, 3]);
  });
});
