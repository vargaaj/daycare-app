// `xlsx` provides both workbook parsing and utilities for reading rows.
import { read, utils } from 'xlsx';
// Shared list of headers the upload template must contain.
import { UPLOAD_REQUIRED_COLUMNS } from '@/lib/upload/shared';
// Normalized row shape returned from the parser.
import type { WorksheetChildRow } from '@/types/upload';
// Structured error used to carry a user-facing message and HTTP status.
import { UploadRouteError } from '@/lib/upload/server/errors';

// Excel serial dates are counted from this epoch in the workbook parser.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

// Tiny formatter helper used by the ISO date builder below.
const pad = (value: number) => value.toString().padStart(2, '0');

/**
 * Formats a date as a calendar-only ISO string using UTC getters so workbook
 * parsing stays stable across server time zones.
 */
const formatDate = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;

/**
 * Builds a calendar date from explicit year/month/day parts and rejects values
 * that overflow into a different month.
 */
const buildDateFromParts = (
  year: number,
  month: number,
  day: number
): string | null => {
  // Create a UTC date so the result does not shift across server time zones.
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    // Reject invalid dates by verifying the constructed date still matches the
    // requested year, month, and day parts exactly.
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return formatDate(date);
};

/**
 * Normalizes common typed and string DOB values from the spreadsheet into the
 * ISO format expected by the rest of the upload pipeline.
 */
export const normalizeWorksheetDob = (value: unknown): string | null => {
  // `xlsx` can already give us real Date objects when the workbook metadata
  // marks the cell as a date, so this is the cleanest happy path.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDate(value);
  }

  // Excel sometimes stores dates as serial day counts. Convert them back to a
  // real JS Date relative to Excel's epoch before formatting.
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = Math.round(value * 24 * 60 * 60 * 1000);
    const date = new Date(EXCEL_EPOCH + milliseconds);
    return Number.isNaN(date.getTime()) ? null : formatDate(date);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // Handle ISO strings explicitly so we reject invalid dates such as
    // `2019-02-31` instead of letting the Date constructor overflow them.
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return buildDateFromParts(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3])
      );
    }

    // Accept the common spreadsheet-style `M/D/YYYY` and `M.D.YYYY` variants.
    const slashMatch = trimmed.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (slashMatch) {
      return buildDateFromParts(
        Number(slashMatch[3]),
        Number(slashMatch[1]),
        Number(slashMatch[2])
      );
    }

    // Fall back to the platform parser for any other date-like string the user
    // may have in the sheet, but only if the result is a real date.
    const parsedDate = new Date(trimmed.replace(/[.]/g, '/'));
    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDate(parsedDate);
    }
  }

  return null;
};

/**
 * Parses the first worksheet in the uploaded workbook and enforces the
 * spreadsheet contract used by the upload flow.
 */
export function parseUploadedWorkbook(buffer: Buffer): WorksheetChildRow[] {
  // Parse the uploaded workbook once and let `xlsx` produce Date objects when possible.
  const workbook = read(buffer, { type: 'buffer', cellDates: true });

  if (workbook.SheetNames.length === 0) {
    throw new UploadRouteError(
      'The uploaded file does not contain any sheets.',
      400
    );
  }

  // The upload flow only looks at the first sheet in the workbook.
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Read the header row as a flat array so we can validate the template shape.
  const headerRows = utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
  });
  // Trim every header value so small spreadsheet whitespace mistakes do not break uploads.
  const headers = headerRows[0]?.map((value) => String(value ?? '').trim());

  if (!headers) {
    throw new UploadRouteError(
      'Unable to read the header row from the uploaded file.',
      400
    );
  }

  // Validate the upload template before we process any child rows so users get
  // a direct fix list when the workbook shape is wrong.
  const missingColumns = UPLOAD_REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column)
  );

  if (missingColumns.length > 0) {
    throw new UploadRouteError(
      `Missing required columns: ${missingColumns.join(
        ', '
      )}. Please update the spreadsheet and try again.`,
      400
    );
  }

  const records = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    // Fill missing cells with `null` so required-field checks are consistent.
    defval: null,
    // Use formatted values rather than raw numeric/date cell internals.
    raw: false,
    // Keep blank rows in the array so `index + 2` still points at the real
    // spreadsheet row number when we report validation errors back to the user.
    blankrows: true,
  });

  const invalidRows: number[] = [];
  const rows: WorksheetChildRow[] = [];

  // Walk each worksheet row once so we can ignore fully blank lines while still
  // reporting exact spreadsheet row numbers for partially completed entries.
  records.forEach((record, index) => {
    // Normalize every required field into trimmed strings before validation.
    const firstName = String(record['First Name'] ?? '').trim();
    const lastName = String(record['Last Name'] ?? '').trim();
    const classroom = String(record['Classroom'] ?? '').trim();
    const schedule = String(record['Schedule'] ?? '').trim();
    const dob = normalizeWorksheetDob(record['Dob']);

    // Ignore rows that are completely empty so blank lines in the workbook do
    // not become validation errors.
    const isEmptyRow =
      !firstName && !lastName && !classroom && !schedule && !dob;

    if (isEmptyRow) {
      return;
    }

    if (!firstName || !lastName || !classroom || !schedule || !dob) {
      // Add 2 because worksheet row numbers are 1-based and row 1 is the header row.
      invalidRows.push(index + 2);
      return;
    }

    // Push the normalized row shape the persistence layer expects.
    rows.push({ firstName, lastName, classroom, schedule, dob });
  });

  if (rows.length === 0) {
    throw new UploadRouteError(
      'No classroom data found in the uploaded spreadsheet.',
      400
    );
  }

  if (invalidRows.length > 0) {
    // Report every incomplete row in one pass so the user can fix the sheet in
    // a single edit instead of discovering problems one upload at a time.
    throw new UploadRouteError(
      `Rows ${invalidRows.join(
        ', '
      )} are missing required values. Please fix them and re-upload the file.`,
      400
    );
  }

  return rows;
}
