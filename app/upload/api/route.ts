import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { read, utils } from 'xlsx';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type {
  UploadErrorResponse,
  UploadSuccessCounts,
  UploadSuccessResponse,
  WorksheetChildRow,
} from '@/types/upload';

const REQUIRED_COLUMNS = [
  'First Name',
  'Last Name',
  'Classroom',
  'Dob',
  'Schedule',
] as const;

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export const runtime = 'nodejs';

const pad = (value: number) => value.toString().padStart(2, '0');

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDob = (value: unknown): string | null => {
  if (value instanceof Date) {
    return formatDate(value);
  }

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

    const normalized = trimmed.replace(/[.]/g, '/');
    const parsedDate = new Date(normalized);
    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDate(parsedDate);
    }
  }

  return null;
};

const sanitizeFileName = (name: string) =>
  name
    .replaceAll('\\', '')
    .replaceAll('/', '')
    .replace(/[^\w.\-]/g, '_');

const extractRows = (buffer: Buffer): WorksheetChildRow[] => {
  const workbook = read(buffer, { type: 'buffer', cellDates: true });

  if (workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file does not contain any sheets.');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const headerRows = utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
  });
  const headers = headerRows[0]?.map((value) =>
    typeof value === 'string' ? value.trim() : String(value)
  );

  if (!headers) {
    throw new Error('Unable to read the header row from the uploaded file.');
  }

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingColumns.join(
        ', '
      )}. Please update the spreadsheet and try again.`
    );
  }

  const records = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  const invalidRows: number[] = [];
  const rows: WorksheetChildRow[] = [];

  records.forEach((record, index) => {
    const firstName = String(record['First Name'] ?? '').trim();
    const lastName = String(record['Last Name'] ?? '').trim();
    const classroom = String(record['Classroom'] ?? '').trim();
    const schedule = String(record['Schedule'] ?? '').trim();
    const dob = parseDob(record['Dob']);

    const isEmptyRow =
      !firstName && !lastName && !classroom && !schedule && !dob;

    if (isEmptyRow) {
      return;
    }

    if (!firstName || !lastName || !classroom || !schedule || !dob) {
      invalidRows.push(index + 2);
      return;
    }

    rows.push({ firstName, lastName, classroom, schedule, dob });
  });

  if (rows.length === 0) {
    throw new Error('No classroom data found in the uploaded spreadsheet.');
  }

  if (invalidRows.length > 0) {
    throw new Error(
      `Rows ${invalidRows.join(
        ', '
      )} are missing required values. Please fix them and re-upload the file.`
    );
  }

  return rows;
};

const buildChildKey = (firstName: string, lastName: string, dob: string) =>
  `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob}`;

const buildClassroomKey = (name: string) => name.toLowerCase();

const successResponse = (response: UploadSuccessResponse) =>
  NextResponse.json(response, { status: 201 });

const errorResponse = (error: string, status = 400) =>
  NextResponse.json<UploadErrorResponse>({ success: false, error }, { status });

export async function POST(request: Request) {
  const user = await auth();

  if (!user) {
    return errorResponse('Unauthorized.', 401);
  }

  const userId = user.userId;

  const supabase = getSupabaseAdminClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Invalid form data.', 400);
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return errorResponse('No file was uploaded.', 400);
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return errorResponse('Only .xlsx files are supported.', 400);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return errorResponse('Unable to read the uploaded file.', 400);
  }

  let rows: WorksheetChildRow[];
  try {
    rows = extractRows(buffer);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to parse the uploaded spreadsheet.';
    return errorResponse(message, 400);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedName = sanitizeFileName(file.name);
  const storagePath = `uploads/${userId}/${timestamp}_${sanitizedName}`;

  const { error: storageError } = await supabase.storage
    .from('uploads')
    .upload(storagePath, buffer, {
      contentType:
        file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });

  if (storageError) {
    return errorResponse(
      storageError.message ||
        'We could not store the uploaded file. Please try again.',
      502
    );
  }

  const classroomNames = Array.from(
    new Set(rows.map((row) => row.classroom.trim()).filter(Boolean))
  );

  const { data: existingClassrooms, error: classroomsSelectError } =
    await supabase.from('classrooms').select('id, name').eq('user_id', userId);

  if (classroomsSelectError) {
    return errorResponse(
      'Failed to load existing classrooms. Please try again.',
      500
    );
  }

  const classroomMap = new Map<string, string>();
  existingClassrooms?.forEach((classroom) => {
    classroomMap.set(buildClassroomKey(classroom.name), classroom.id);
  });

  const missingClassrooms = classroomNames.filter(
    (name) => !classroomMap.has(buildClassroomKey(name))
  );

  if (missingClassrooms.length > 0) {
    return errorResponse(
      `The following classrooms do not exist for your account: ${missingClassrooms.join(
        ', '
      )}. Please create them before uploading.`,
      400
    );
  }

  const { data: existingChildren, error: childrenSelectError } = await supabase
    .from('children')
    .select('id, first_name, last_name, dob')
    .eq('user_id', userId);

  if (childrenSelectError) {
    return errorResponse(
      'Failed to load existing children. Please try again.',
      500
    );
  }

  const childMap = new Map<string, string>();
  existingChildren?.forEach((child) => {
    const key = buildChildKey(child.first_name, child.last_name, child.dob);
    childMap.set(key, child.id);
  });

  const uniqueChildEntries = new Map<string, WorksheetChildRow>();
  rows.forEach((row) => {
    uniqueChildEntries.set(
      buildChildKey(row.firstName, row.lastName, row.dob),
      row
    );
  });

  const newChildrenPayload = Array.from(uniqueChildEntries.entries())
    .filter(([key]) => !childMap.has(key))
    .map(([, row]) => ({
      user_id: userId,
      first_name: row.firstName,
      last_name: row.lastName,
      dob: row.dob,
    }));

  let childrenCreated = 0;

  if (newChildrenPayload.length > 0) {
    const { data: insertedChildren, error } = await supabase
      .from('children')
      .insert(newChildrenPayload)
      .select('id, first_name, last_name, dob');

    if (error) {
      return errorResponse(
        'Failed to create child records. Please try again.',
        500
      );
    }

    insertedChildren.forEach((child) => {
      const key = buildChildKey(child.first_name, child.last_name, child.dob);
      childMap.set(key, child.id);
    });
    childrenCreated = insertedChildren.length;
  }

  const childrenReused = uniqueChildEntries.size - childrenCreated;

  const currentMonth = new Date();
  const monthDate = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const monthISO = formatDate(monthDate);

  const assignmentsPayload = Array.from(uniqueChildEntries.entries()).map(
    ([key, row]) => {
      const childId = childMap.get(key);
      const classroomId = classroomMap.get(buildClassroomKey(row.classroom));

      if (!childId || !classroomId) {
        throw new Error(
          `Unable to resolve classroom or child for ${row.firstName} ${row.lastName}.`
        );
      }

      return {
        child_id: childId,
        classroom_id: classroomId,
        user_id: userId,
        month: monthISO,
        schedule: row.schedule,
      };
    }
  );

  let assignmentsProcessed = 0;

  if (assignmentsPayload.length > 0) {
    const childIds = Array.from(
      new Set(assignmentsPayload.map((assignment) => assignment.child_id))
    );

    if (childIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('classroom_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('month', monthISO)
        .in('child_id', childIds);

      if (deleteError) {
        console.error(
          'Failed to clear existing classroom assignments',
          deleteError
        );
        return errorResponse(
          'Failed to prepare classroom assignments. Please try again.',
          500
        );
      }
    }

    const { data: insertedAssignments, error: insertError } = await supabase
      .from('classroom_assignments')
      .insert(assignmentsPayload)
      .select('id');

    if (insertError) {
      console.error('Failed to insert classroom assignments', insertError);
      return errorResponse(
        'Failed to save classroom assignments. Please try again.',
        500
      );
    }

    assignmentsProcessed =
      insertedAssignments?.length ?? assignmentsPayload.length;
  }

  const counts: UploadSuccessCounts = {
    childrenCreated,
    childrenReused,
    assignmentsProcessed,
  };

  return successResponse({
    success: true,
    filePath: storagePath,
    counts,
  });
}
