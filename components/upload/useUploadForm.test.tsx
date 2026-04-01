// Hook test helpers from React Testing Library.
import { act, renderHook } from '@testing-library/react';
// Event type helpers used by the hook event stubs below.
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import {
  // Shared unsupported-file error expected from local validation.
  UPLOAD_FILE_TYPE_ERROR,
  // Shared missing-file error expected from local validation.
  UPLOAD_MISSING_FILE_ERROR,
} from '@/lib/upload/shared';
// Hook under test.
import { useUploadForm } from '@/components/upload/useUploadForm';
import { beforeEach, expect, it, vi } from 'vitest';
import { describe } from 'node:test';

// Hoisted mocks let Vitest replace the modules before the hook file imports them.
const hookMocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  uploadClassroomSpreadsheet: vi.fn(),
}));

// Mock the Next.js router so the hook can be tested without a real app router.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: hookMocks.routerPush,
  }),
}));

// Mock the API client helper so tests can control success and failure responses.
vi.mock('@/lib/upload/uploadClient', () => ({
  uploadClassroomSpreadsheet: hookMocks.uploadClassroomSpreadsheet,
}));

// jsdom in this repo does not provide a real DataTransfer/FileList pair, so we
// build the smallest array-like object the hook needs for file selection.
const createFileList = (...files: File[]) => {
  return Object.assign([...files], {
    item: (index: number) => files[index] ?? null,
  }) as unknown as FileList;
};

// The hook only calls `preventDefault`, so the tests can use a compact submit
// event stub instead of rendering a full form element.
const createSubmitEvent = () =>
  ({
    preventDefault: vi.fn(),
  }) as unknown as FormEvent<HTMLFormElement>;

describe('useUploadForm', () => {
  beforeEach(() => {
    // Reset the shared mocks so each test starts with a clean call history.
    hookMocks.routerPush.mockReset();
    hookMocks.uploadClassroomSpreadsheet.mockReset();
  });

  // Purpose: prove the hook blocks submit immediately when no file has been selected.
  it('shows a missing-file error before making a request', async () => {
    const { result } = renderHook(() => useUploadForm());

    await act(async () => {
      await result.current.onSubmit(createSubmitEvent());
    });

    // The hook should never call the upload client when local validation fails.
    expect(hookMocks.uploadClassroomSpreadsheet).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      type: 'error',
      message: UPLOAD_MISSING_FILE_ERROR,
    });
  });

  // Purpose: prove file-extension validation happens on the client before network I/O.
  it('rejects invalid file types locally', async () => {
    const { result } = renderHook(() => useUploadForm());
    const badFile = new File(['bad'], 'roster.csv', { type: 'text/csv' });

    // Feed the hook a fake input-change event with a `.csv` file attached.
    act(() => {
      result.current.onInputChange({
        target: { files: createFileList(badFile) },
      } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.onSubmit(createSubmitEvent());
    });

    // The hook should still stop before calling the upload client.
    expect(hookMocks.uploadClassroomSpreadsheet).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      type: 'error',
      message: UPLOAD_FILE_TYPE_ERROR,
    });
  });

  // Purpose: prove the happy path clears local state and redirects after success.
  it('uploads successfully, clears the input, and redirects to the dashboard', async () => {
    const { result } = renderHook(() => useUploadForm());
    const file = new File(['xlsx'], 'roster.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    // Simulate the hidden input still holding the previously chosen file path.
    const input = { value: 'stale-file-value' } as HTMLInputElement;

    // Return the same shape the real client helper resolves with so the hook
    // executes its success branch exactly as production code would.
    hookMocks.uploadClassroomSpreadsheet.mockResolvedValue({
      success: true,
      filePath: 'uploads/user-1/roster.xlsx',
      counts: {
        childrenCreated: 2,
        childrenReused: 0,
        assignmentsProcessed: 2,
      },
    });

    // Seed both the input ref and the selected-file state before submit.
    act(() => {
      (
        result.current.fileInputRef as { current: HTMLInputElement | null }
      ).current = input;
      result.current.onInputChange({
        target: { files: createFileList(file) },
      } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.onSubmit(createSubmitEvent());
    });

    // The hook should call the upload helper with the selected file and then
    // clear UI state once the request resolves.
    expect(hookMocks.uploadClassroomSpreadsheet).toHaveBeenCalledWith(file);
    expect(hookMocks.routerPush).toHaveBeenCalledWith('/dashboard');
    expect(result.current.selectedFile).toBeNull();
    expect(input.value).toBe('');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.status).toEqual({
      type: 'success',
      message: 'Upload complete! Your classrooms and assignments are updated.',
      filePath: 'uploads/user-1/roster.xlsx',
      counts: {
        childrenCreated: 2,
        childrenReused: 0,
        assignmentsProcessed: 2,
      },
    });
  });

  // Purpose: prove failed uploads surface the API message and keep the selected file.
  it('shows the API error and leaves the selected file in place on failure', async () => {
    const { result } = renderHook(() => useUploadForm());
    const file = new File(['xlsx'], 'roster.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Make the upload helper reject with the same message the UI should render.
    hookMocks.uploadClassroomSpreadsheet.mockRejectedValue(
      new Error('Failed to save classroom assignments. Please try again.')
    );

    act(() => {
      result.current.onInputChange({
        target: { files: createFileList(file) },
      } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.onSubmit(createSubmitEvent());
    });

    // The hook should not navigate away when the request fails.
    expect(hookMocks.routerPush).not.toHaveBeenCalled();
    expect(result.current.selectedFile?.name).toBe('roster.xlsx');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.status).toEqual({
      type: 'error',
      message: 'Failed to save classroom assignments. Please try again.',
    });
  });

  // Purpose: prove drag-over state flips on and off so the dropzone can style itself.
  it('tracks drag state across drag over and drag leave', () => {
    const { result } = renderHook(() => useUploadForm());

    // Trigger the drag-over branch that should set the highlighted state.
    act(() => {
      result.current.onDragOver({
        preventDefault: vi.fn(),
      } as unknown as DragEvent<HTMLLabelElement>);
    });

    expect(result.current.isDragging).toBe(true);

    // Trigger the drag-leave branch that should clear the highlighted state.
    act(() => {
      result.current.onDragLeave();
    });

    expect(result.current.isDragging).toBe(false);
  });

  // Purpose: prove dropped-file state survives even when the DOM input rejects FileList assignment.
  it('keeps hook state in sync when dropped-file input assignment fails', () => {
    const { result } = renderHook(() => useUploadForm());
    // Silence the expected dev warning so the test output stays readable.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = new File(['xlsx'], 'roster.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const input = { value: 'stale-file-value' } as HTMLInputElement;

    // Mirror the browser edge case the helper is designed for: assigning the
    // dropped FileList throws, so the hook has to preserve its own state and
    // clear the DOM input manually.
    // Simulate the browser refusing programmatic writes to `input.files`.
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => null,
      set: () => {
        throw new Error('Assignment blocked by the test input');
      },
    });

    // Drop the file onto the hook and let the fallback logic run.
    act(() => {
      (
        result.current.fileInputRef as { current: HTMLInputElement | null }
      ).current = input;
      result.current.onDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: createFileList(file) },
      } as unknown as DragEvent<HTMLLabelElement>);
    });

    // The hook should keep the selected file in React state and clear the stale DOM value.
    expect(result.current.selectedFile?.name).toBe('roster.xlsx');
    expect(result.current.isDragging).toBe(false);
    expect(input.value).toBe('');

    // Restore the console spy so later tests see the normal console behavior.
    warnSpy.mockRestore();
  });
});
