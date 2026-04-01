// Force this suite onto the Node environment because the parser consumes Buffer values.
// @vitest-environment node

// Hoisted mocks let the suite override only `read` while still using the real
// `xlsx` utility helpers to build workbook buffers.
const xlsxMocks = vi.hoisted(() => ({
  read: vi.fn(),
  defaultRead: null as null | typeof import('xlsx').read,
}));

// Re-export the real `xlsx` module but swap in a controllable `read` mock.
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  xlsxMocks.defaultRead = actual.read;
  xlsxMocks.read.mockImplementation(actual.read);

  return {
    ...actual,
    read: xlsxMocks.read,
  };
});

// Real `xlsx` helpers used to build workbook buffers for parser coverage.
import { utils, write } from 'xlsx';
import {
  // Normalization helper under test.
  normalizeWorksheetDob,
  // Workbook parser under test.
  parseUploadedWorkbook,
} from '@/lib/upload/server/workbook';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Build small in-memory workbooks so the parser tests exercise real `xlsx`
// behavior instead of hand-written worksheet objects.
const createWorkbookBuffer = (
  rows: Array<Array<string | number | Date | null>>
) => {
  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(workbook, sheet, 'Roster');
  return write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  }) as Buffer;
};

describe('parseUploadedWorkbook', () => {
  beforeEach(() => {
    // Reset `read` to the real implementation before each parser test unless the
    // individual test overrides it for a targeted edge case.
    xlsxMocks.read.mockReset();
    xlsxMocks.read.mockImplementation(xlsxMocks.defaultRead!);
  });

  // Purpose: prove the parser rejects workbooks that contain no sheets at all.
  it('rejects a workbook with no sheets', () => {
    // This edge case is easiest to force by mocking `read`, because `xlsx`
    // itself will not normally produce a persisted workbook with zero sheets.
    xlsxMocks.read.mockReturnValue({
      SheetNames: [],
      Sheets: {},
    });

    expect(() => parseUploadedWorkbook(Buffer.from('unused'))).toThrowError(
      'The uploaded file does not contain any sheets.'
    );
  });

  // Purpose: prove the parser fails when it cannot read a header row.
  it('rejects a workbook without a readable header row', () => {
    const workbook = createWorkbookBuffer([]);

    expect(() => parseUploadedWorkbook(workbook)).toThrowError(
      'Unable to read the header row from the uploaded file.'
    );
  });

  // Purpose: prove the parser enforces the required upload template columns.
  it('rejects missing required columns', () => {
    const workbook = createWorkbookBuffer([
      ['First Name', 'Last Name', 'Classroom', 'Dob'],
      ['Avery', 'Johnson', 'Toddlers', '2019-03-14'],
    ]);

    expect(() => parseUploadedWorkbook(workbook)).toThrowError(
      'Missing required columns: Schedule. Please update the spreadsheet and try again.'
    );
  });

  // Purpose: prove fully blank spreadsheet rows are ignored instead of treated as errors.
  it('ignores fully blank rows', () => {
    const workbook = createWorkbookBuffer([
      ['First Name', 'Last Name', 'Classroom', 'Dob', 'Schedule'],
      ['Avery', 'Johnson', 'Toddlers', '2019-03-14', 'M,W,Th,F'],
      [null, null, null, null, null],
    ]);

    // The parser should return only the real child row and skip the blank one.
    expect(parseUploadedWorkbook(workbook)).toEqual([
      {
        firstName: 'Avery',
        lastName: 'Johnson',
        classroom: 'Toddlers',
        dob: '2019-03-14',
        schedule: 'M,W,Th,F',
      },
    ]);
  });

  // Purpose: prove the parser rejects spreadsheets that contain headers but no data rows.
  it('rejects a workbook with no non-empty child rows', () => {
    const workbook = createWorkbookBuffer([
      ['First Name', 'Last Name', 'Classroom', 'Dob', 'Schedule'],
      [null, null, null, null, null],
    ]);

    expect(() => parseUploadedWorkbook(workbook)).toThrowError(
      'No classroom data found in the uploaded spreadsheet.'
    );
  });

  // Purpose: prove validation error row numbers match the original spreadsheet row numbers.
  it('reports exact row numbers for partially filled rows', () => {
    const workbook = createWorkbookBuffer([
      ['First Name', 'Last Name', 'Classroom', 'Dob', 'Schedule'],
      ['Avery', 'Johnson', 'Toddlers', '2019-03-14', 'M,W,Th,F'],
      ['Jamie', 'Lee', 'Toddlers', null, 'M'],
      [null, null, null, null, null],
      ['Taylor', 'Fox', 'Preschool', '2018-01-09', null],
    ]);

    // The blank row in the middle is intentional: it proves the parser keeps
    // real spreadsheet row numbers instead of collapsing them during validation.
    expect(() => parseUploadedWorkbook(workbook)).toThrowError(
      'Rows 3, 5 are missing required values. Please fix them and re-upload the file.'
    );
  });
});

describe('normalizeWorksheetDob', () => {
  // Purpose: prove DOB normalization accepts the three input shapes the workbook can produce.
  it('normalizes Date, Excel serial, and parseable string inputs', () => {
    expect(
      normalizeWorksheetDob(new Date(Date.UTC(2019, 2, 14, 12, 0, 0)))
    ).toBe('2019-03-14');
    expect(normalizeWorksheetDob(43538)).toBe('2019-03-14');
    expect(normalizeWorksheetDob('3/14/2019')).toBe('2019-03-14');
  });
});
