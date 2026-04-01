// Next.js response helper used to return structured JSON from the route.
import { NextResponse } from 'next/server';
// Clerk server helper used to read the signed-in user inside a route handler.
import { auth } from '@clerk/nextjs/server';
// Server-only Supabase admin client used for storage and database writes.
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  // Validates the uploaded file extension before any heavy work starts.
  isXlsxFileName,
  // Reused user-facing error for unsupported file extensions.
  UPLOAD_FILE_TYPE_ERROR,
  // Generic fallback error for unexpected internal failures.
  UPLOAD_UNEXPECTED_ERROR,
} from '@/lib/upload/shared';
import {
  // Type guard that lets the route preserve helper-provided status codes.
  isUploadRouteError,
  // Structured error class used by the upload helper modules.
  UploadRouteError,
} from '@/lib/upload/server/errors';
// Helper that rewrites the parsed workbook rows into database records.
import { persistUploadedWorkbookRows } from '@/lib/upload/server/persistUpload';
// Helper that stores the raw workbook in Supabase Storage.
import { storeUploadedWorkbook } from '@/lib/upload/server/storage';
// Helper that parses and validates workbook rows before persistence.
import { parseUploadedWorkbook } from '@/lib/upload/server/workbook';
import type {
  // Error payload shape returned by the route.
  UploadErrorResponse,
  // Success payload shape returned by the route.
  UploadSuccessResponse,
} from '@/types/upload';

// Force the route onto the Node runtime because it depends on Buffer and the
// server-side `xlsx` parser rather than the Edge runtime.
export const runtime = 'nodejs';

// Wraps successful payloads in the same `201` response shape everywhere.
const successResponse = (response: UploadSuccessResponse) =>
  NextResponse.json(response, { status: 201 });

// Wraps failed payloads in the shared error response shape.
const errorResponse = (error: string, status = 400) =>
  NextResponse.json<UploadErrorResponse>({ success: false, error }, { status });

/**
 * Reads the browser-provided file into a Node buffer so the workbook parser and
 * storage upload share the same raw bytes.
 */
const readUploadedFileBuffer = async (file: File): Promise<Buffer> => {
  try {
    // Convert the browser `File` object into the Node `Buffer` shape used by
    // both the workbook parser and the storage helper.
    return Buffer.from(await file.arrayBuffer());
  } catch {
    // Surface a user-facing upload error instead of leaking a low-level read failure.
    throw new UploadRouteError('Unable to read the uploaded file.', 400);
  }
};

/**
 * Runs best-effort optimization after a successful upload without blocking the
 * user from seeing a success response if optimization fails.
 */
const runUploadOptimization = async (
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string
) => {
  try {
    // Load the optimizer lazily so the route only pays the cost after a
    // successful upload rather than on every import of the route module.
    const { optimizeFutureClassrooms } = await import(
      '@/lib/optimization/optimizeClassrooms'
    );
    // Re-run future-month optimization using the freshly uploaded classroom data.
    await optimizeFutureClassrooms(supabase, userId);
  } catch (error) {
    // Upload success should not be rolled back just because the follow-up
    // optimization pass failed, so we only log the failure here.
    console.error('Failed to run optimization after upload', error);
  }
};

/**
 * Accepts an uploaded classroom workbook, stores the original spreadsheet, and
 * replaces the current upload-backed records for the signed-in user.
 */
export async function POST(request: Request) {
  // The upload endpoint only makes sense for a signed-in account because every
  // downstream storage and database write is scoped by `userId`.
  const { userId } = await auth();

  if (!userId) {
    // Stop before touching storage or database state when the request is anonymous.
    return errorResponse('Unauthorized.', 401);
  }

  // Create the shared Supabase client once and pass it through the helper pipeline.
  const supabase = getSupabaseAdminClient();

  // FormData parsing can throw for malformed multipart bodies, so isolate that
  // failure and turn it into a normal JSON error response.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Invalid form data.', 400);
  }

  // The browser submits the workbook under the `file` key. Anything else should
  // fail early before we touch parsing, storage, or database state.
  const file = formData.get('file');

  if (!(file instanceof File)) {
    // Reject requests that omit the upload field or send a non-file value.
    return errorResponse('No file was uploaded.', 400);
  }

  if (!isXlsxFileName(file.name)) {
    // Reject unsupported file types before reading bytes or parsing the workbook.
    return errorResponse(UPLOAD_FILE_TYPE_ERROR, 400);
  }

  try {
    // The route is intentionally just orchestration:
    // 1. read the raw bytes once
    // 2. parse and validate workbook rows
    // 3. store the original file
    // 4. persist the normalized child/assignment data
    // 5. trigger best-effort optimization
    const buffer = await readUploadedFileBuffer(file);
    // Parse and validate the workbook before we write anything to storage or the database.
    const rows = parseUploadedWorkbook(buffer);
    // Persist the original workbook bytes so the upload has an audit trail.
    const filePath = await storeUploadedWorkbook({
      supabase,
      userId,
      file,
      buffer,
    });
    // Rewrite the parsed rows into the app's child and assignment tables.
    const counts = await persistUploadedWorkbookRows({ supabase, userId, rows });

    // Optimization runs after the core upload succeeds and never changes the response shape.
    await runUploadOptimization(supabase, userId);

    // Return the same success payload the client hook expects.
    return successResponse({
      success: true,
      filePath,
      counts,
    });
  } catch (error) {
    // Known upload failures already carry the user-facing status/message pair
    // chosen by the helper that detected the problem.
    if (isUploadRouteError(error)) {
      // Reuse the status/message chosen by the helper that detected the problem.
      return errorResponse(error.message, error.status);
    }

    // Anything else is treated as an internal failure so the API still returns
    // a JSON payload instead of crashing the route with an opaque framework error.
    console.error('Unexpected upload failure', error);
    // Fall back to the shared generic message for truly unexpected failures.
    return errorResponse(UPLOAD_UNEXPECTED_ERROR, 500);
  }
}

