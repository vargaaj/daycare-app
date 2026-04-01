// Route handler under test.
import { POST } from '@/app/upload/api/route';
// Structured upload error used to simulate helper failures.
import { UploadRouteError } from '@/lib/upload/server/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force this suite onto the Node environment because the route uses Buffer-based logic.
// @vitest-environment node

// Hoisted route mocks let each test override a single boundary without loading
// the real Clerk, Supabase, workbook, storage, or optimization modules.
const routeMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  parseUploadedWorkbook: vi.fn(),
  storeUploadedWorkbook: vi.fn(),
  persistUploadedWorkbookRows: vi.fn(),
  optimizeFutureClassrooms: vi.fn(),
}));

// Mock Clerk auth so the route tests can control the signed-in user id.
vi.mock('@clerk/nextjs/server', () => ({
  auth: routeMocks.auth,
}));

// Mock the Supabase admin client so the route only exercises orchestration logic.
vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdminClient: routeMocks.getSupabaseAdminClient,
}));

// Mock the workbook parser helper so tests can force parse success or failure.
vi.mock('@/lib/upload/server/workbook', () => ({
  parseUploadedWorkbook: routeMocks.parseUploadedWorkbook,
}));

// Mock the storage helper so tests can force storage success or failure.
vi.mock('@/lib/upload/server/storage', () => ({
  storeUploadedWorkbook: routeMocks.storeUploadedWorkbook,
}));

// Mock the persistence helper so tests can focus on route-level error handling.
vi.mock('@/lib/upload/server/persistUpload', () => ({
  persistUploadedWorkbookRows: routeMocks.persistUploadedWorkbookRows,
}));

// Mock optimization so tests can verify the best-effort behavior explicitly.
vi.mock('@/lib/optimization/optimizeClassrooms', () => ({
  optimizeFutureClassrooms: routeMocks.optimizeFutureClassrooms,
}));

// The route only calls `request.formData()`, so a tiny request stub keeps these
// tests focused on route orchestration instead of fetch implementation details.
const createRequest = (formDataResult: FormData | Promise<FormData>) =>
  ({
    formData: vi.fn().mockImplementation(() => formDataResult),
  }) as unknown as Request;

describe('POST /upload/api', () => {
  beforeEach(() => {
    // Reset all mocks and silence expected error logging between tests.
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Most tests start from the happy-path defaults below and only override the
    // single boundary they want to verify.
    routeMocks.auth.mockResolvedValue({ userId: 'user-123' });
    routeMocks.getSupabaseAdminClient.mockReturnValue({ name: 'supabase' });
    routeMocks.parseUploadedWorkbook.mockReturnValue([
      {
        firstName: 'Avery',
        lastName: 'Johnson',
        classroom: 'Toddlers',
        dob: '2019-03-14',
        schedule: 'M,W,Th,F',
      },
    ]);
    routeMocks.storeUploadedWorkbook.mockResolvedValue(
      'uploads/user-123/roster.xlsx'
    );
    routeMocks.persistUploadedWorkbookRows.mockResolvedValue({
      childrenCreated: 1,
      childrenReused: 0,
      assignmentsProcessed: 1,
    });
    routeMocks.optimizeFutureClassrooms.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore any spies created during the test so nothing leaks into the next one.
    vi.restoreAllMocks();
  });

  // Purpose: prove the route rejects anonymous callers before parsing or storage work.
  it('returns 401 when no user id is present', async () => {
    routeMocks.auth.mockResolvedValue({ userId: null });

    const response = await POST(createRequest(new FormData()));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized.',
    });
  });

  // Purpose: prove malformed multipart bodies become a normal `400` JSON response.
  it('returns 400 when form data cannot be read', async () => {
    const response = await POST(
      createRequest(Promise.reject(new Error('bad form data')))
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Invalid form data.',
    });
  });

  // Purpose: prove the route validates the presence of the file field before doing any work.
  it('returns 400 when no file is uploaded', async () => {
    const response = await POST(createRequest(new FormData()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'No file was uploaded.',
    });
  });

  // Purpose: prove unsupported file extensions are rejected before the file is read.
  it('returns 400 for unsupported file types', async () => {
    const formData = new FormData();
    // Append a `.csv` file so the shared extension validation fails immediately.
    formData.append(
      'file',
      new File(['bad'], 'roster.csv', { type: 'text/csv' })
    );

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Only .xlsx files are supported.',
    });
  });

  // Purpose: prove parser failures preserve the parser's chosen message and status code.
  it('maps parser validation errors to a 400 response', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new File(['xlsx'], 'roster.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    // Force the parser helper to fail with a structured upload error.
    routeMocks.parseUploadedWorkbook.mockImplementation(() => {
      throw new UploadRouteError(
        'Rows 3 are missing required values. Please fix them and re-upload the file.',
        400
      );
    });

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error:
        'Rows 3 are missing required values. Please fix them and re-upload the file.',
    });
  });

  // Purpose: prove storage failures surface as `502` errors from the route.
  it('maps storage failures to a 502 response', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new File(['xlsx'], 'roster.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    // Force the storage helper to reject with the same error shape the real helper uses.
    routeMocks.storeUploadedWorkbook.mockRejectedValue(
      new UploadRouteError(
        'We could not store the uploaded file. Please try again.',
        502
      )
    );

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'We could not store the uploaded file. Please try again.',
    });
  });

  // Purpose: prove persistence failures surface as `500` errors from the route.
  it('maps persistence failures to a 500 response', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new File(['xlsx'], 'roster.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    // Force the persistence helper to reject after parsing and storage succeed.
    routeMocks.persistUploadedWorkbookRows.mockRejectedValue(
      new UploadRouteError(
        'Failed to save classroom assignments. Please try again.',
        500
      )
    );

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Failed to save classroom assignments. Please try again.',
    });
  });

  // Purpose: prove optimization is best-effort and does not block the success response.
  it('returns 201 when the upload succeeds, even if optimization fails', async () => {
    const formData = new FormData();
    const file = new File(['xlsx'], 'roster.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append('file', file);

    // Optimization is intentionally best-effort, so the route should still
    // return success when that final side effect throws.
    routeMocks.optimizeFutureClassrooms.mockRejectedValue(
      new Error('optimizer failed')
    );

    const response = await POST(createRequest(formData));

    // The success path should call the helpers in order and still return `201`.
    expect(routeMocks.parseUploadedWorkbook).toHaveBeenCalled();
    expect(routeMocks.storeUploadedWorkbook).toHaveBeenCalledWith({
      supabase: { name: 'supabase' },
      userId: 'user-123',
      file,
      buffer: expect.any(Buffer),
    });
    expect(routeMocks.persistUploadedWorkbookRows).toHaveBeenCalledWith({
      supabase: { name: 'supabase' },
      userId: 'user-123',
      rows: [
        {
          firstName: 'Avery',
          lastName: 'Johnson',
          classroom: 'Toddlers',
          dob: '2019-03-14',
          schedule: 'M,W,Th,F',
        },
      ],
    });
    expect(routeMocks.optimizeFutureClassrooms).toHaveBeenCalledWith(
      { name: 'supabase' },
      'user-123'
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      filePath: 'uploads/user-123/roster.xlsx',
      counts: {
        childrenCreated: 1,
        childrenReused: 0,
        assignmentsProcessed: 1,
      },
    });
  });
});
