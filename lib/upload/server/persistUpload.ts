// Supabase client type used by the persistence helpers.
import type { SupabaseClient } from '@supabase/supabase-js';
// Shared upload types used by the persistence result and parser input.
import type { UploadSuccessCounts, WorksheetChildRow } from '@/types/upload';
// Structured error used to map helper failures back to HTTP responses.
import { UploadRouteError } from '@/lib/upload/server/errors';

// Input shape for the persistence helper.
type PersistUploadedWorkbookRowsArgs = {
  // Shared Supabase admin client passed in from the route.
  supabase: SupabaseClient;
  // Signed-in user id used to scope all queries.
  userId: string;
  // Parsed worksheet rows ready for database persistence.
  rows: WorksheetChildRow[];
  // Injectable clock mainly useful for tests or future deterministic callers.
  now?: Date;
};

// Minimal classroom record shape needed for name-to-id resolution.
type ClassroomRow = {
  id: string;
  name: string;
};

// Minimal child row shape returned by the insert/select query.
type InsertedChildRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const buildChildKey = (firstName: string, lastName: string, dob: string) =>
  `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob}`;

const buildClassroomKey = (name: string) => name.toLowerCase();

/**
 * Loads the classroom ids needed to turn workbook classroom names into foreign
 * keys during assignment creation.
 */
const loadClassroomMap = async (
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string>> => {
  // Load every classroom for the signed-in user so workbook classroom names can
  // be resolved into foreign keys during assignment creation.
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, name')
    .eq('user_id', userId);

  if (error) {
    throw new UploadRouteError(
      'Failed to load existing classrooms. Please try again.',
      500
    );
  }

  // Store the classroom ids in a case-insensitive lookup keyed by classroom name.
  const classroomMap = new Map<string, string>();
  (data as ClassroomRow[] | null)?.forEach((classroom) => {
    classroomMap.set(buildClassroomKey(classroom.name), classroom.id);
  });

  return classroomMap;
};

/**
 * Clears the current upload-backed records so the import continues to behave as
 * a full replace for the signed-in user.
 */
const resetExistingUploadData = async (
  supabase: SupabaseClient,
  userId: string
) => {
  // Delete assignments first so child deletes do not leave dangling assignment rows.
  const { error: deleteAssignmentsError } = await supabase
    .from('classroom_assignments')
    .delete()
    .eq('user_id', userId);

  if (deleteAssignmentsError) {
    console.error(
      'Failed to delete existing assignments',
      deleteAssignmentsError
    );
    throw new UploadRouteError(
      'Failed to reset your previous assignments. Please try again.',
      500
    );
  }

  // Delete the old child records after assignments are gone because the upload
  // flow treats each import as a full replace.
  const { error: deleteChildrenError } = await supabase
    .from('children')
    .delete()
    .eq('user_id', userId);

  if (deleteChildrenError) {
    console.error('Failed to delete existing children', deleteChildrenError);
    throw new UploadRouteError(
      'Failed to reset your previous children. Please try again.',
      500
    );
  }
};

/**
 * Persists the parsed workbook rows by validating classroom references,
 * recreating child records, and inserting current-month assignments.
 */
export async function persistUploadedWorkbookRows({
  supabase,
  userId,
  rows,
  now = new Date(),
}: PersistUploadedWorkbookRowsArgs): Promise<UploadSuccessCounts> {
  // Resolve every classroom name up front so we can fail before destructive
  // deletes if the workbook references classrooms the user has not configured.
  const classroomMap = await loadClassroomMap(supabase, userId);
  const classroomNames = Array.from(
    // Trim and deduplicate the classroom names referenced by the workbook rows.
    new Set(rows.map((row) => row.classroom.trim()).filter(Boolean))
  );
  const missingClassrooms = classroomNames.filter(
    (name) => !classroomMap.has(buildClassroomKey(name))
  );

  if (missingClassrooms.length > 0) {
    throw new UploadRouteError(
      `The following classrooms do not exist for your account: ${missingClassrooms.join(
        ', '
      )}. Please create them before uploading.`,
      400
    );
  }

  await resetExistingUploadData(supabase, userId);

  // Deduplicate children by name + DOB before insertion so repeated rows only
  // create one child record and multiple assignment rows never fight over ids.
  const uniqueChildEntries = new Map<string, WorksheetChildRow>();
  rows.forEach((row) => {
    uniqueChildEntries.set(
      buildChildKey(row.firstName, row.lastName, row.dob),
      row
    );
  });

  const childInserts = Array.from(uniqueChildEntries.values()).map((row) => ({
    // Scope the inserted child to the signed-in user.
    user_id: userId,
    // Copy the normalized parser output into the database column names.
    first_name: row.firstName,
    last_name: row.lastName,
    dob: row.dob,
  }));

  // Recreate the child table from the deduplicated workbook rows. The current
  // upload behavior is a full overwrite, so "reused" remains zero for now.
  const { data: insertedChildren, error: insertChildrenError } = await supabase
    .from('children')
    .insert(childInserts)
    .select('id, first_name, last_name, dob');

  if (insertChildrenError) {
    console.error('Failed to create child records', insertChildrenError);
    throw new UploadRouteError(
      'Failed to create child records. Please try again.',
      500
    );
  }

  const childMap = new Map<string, string>();
  // Build a lookup from the same composite key used during deduplication so we
  // can convert worksheet rows into assignment inserts with stable child ids.
  (insertedChildren as InsertedChildRow[] | null)?.forEach((child) => {
    childMap.set(
      buildChildKey(child.first_name, child.last_name, child.dob),
      child.id
    );
  });

  // Classroom assignments are always written against the first day of the
  // current month because that is the month-key convention used across the app.
  const monthISO = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const assignmentsPayload = Array.from(uniqueChildEntries.entries()).map(
    ([key, row]) => {
      // Look up the child id generated by the insert query.
      const childId = childMap.get(key);
      // Look up the classroom id resolved from the user-configured classrooms.
      const classroomId = classroomMap.get(buildClassroomKey(row.classroom));

      if (!childId || !classroomId) {
        throw new Error(
          `Unable to resolve classroom or child for ${row.firstName} ${row.lastName}.`
        );
      }

      return {
        // Point the assignment at the inserted child record.
        child_id: childId,
        // Point the assignment at the resolved classroom record.
        classroom_id: classroomId,
        // Scope the assignment to the signed-in user.
        user_id: userId,
        // Use the first day of the month as the shared month key format.
        month: monthISO,
        // Preserve the workbook schedule string for later dashboard logic.
        schedule: row.schedule,
      };
    }
  );

  let assignmentsProcessed = 0;

  if (assignmentsPayload.length > 0) {
    // Insert assignments after children so every row already has a resolved
    // foreign key to both the child and classroom tables.
    const { data: insertedAssignments, error: insertAssignmentsError } =
      await supabase
        .from('classroom_assignments')
        .insert(assignmentsPayload)
        .select('id');

    if (insertAssignmentsError) {
      console.error(
        'Failed to insert classroom assignments',
        insertAssignmentsError
      );
      throw new UploadRouteError(
        'Failed to save classroom assignments. Please try again.',
        500
      );
    }

    assignmentsProcessed =
      (insertedAssignments as { id: string }[] | null)?.length ??
      assignmentsPayload.length;
  }

  // The success payload mirrors the UI summary card, so return the exact counts
  // the user will see immediately after the upload completes.
  return {
    childrenCreated: (insertedChildren as InsertedChildRow[] | null)?.length ?? 0,
    childrenReused: 0,
    assignmentsProcessed,
  };
}
