'use client';

// React hooks used to store upload state and hold the hidden file input ref.
import { useRef, useState } from 'react';
// Event types used by the form, input, and drag-and-drop handlers.
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
// Next.js router used to redirect after a successful upload.
import { useRouter } from 'next/navigation';
import {
  // Shared client-side file validation helper.
  getFileValidationError,
  // Reused missing-file error shown before any network call.
  UPLOAD_MISSING_FILE_ERROR,
  // Generic fallback error when something unexpected is thrown client-side.
  UPLOAD_UNEXPECTED_ERROR,
} from '@/lib/upload/shared';
// Client helper that submits the selected workbook to the upload route.
import { uploadClassroomSpreadsheet } from '@/lib/upload/uploadClient';
// Shared status union used by the hook and presentational status component.
import type { UploadStatusState } from '@/types/upload';

/**
 * Best-effort sync from the dropped file list into the hidden input element.
 * Some browsers and test DOM implementations reject programmatic FileList
 * assignment, so the hook keeps its own selected-file state either way.
 */
const syncDroppedFilesToInput = (
  input: HTMLInputElement,
  files: FileList
) => {
  try {
    input.files = files;
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Unable to sync dropped files to hidden input; continuing with selected file state.',
        error
      );
    }
    return false;
  }
};

/**
 * Owns the upload form state and event handlers while leaving visual rendering
 * details to the form's presentational components.
 */
export function useUploadForm() {
  // Holds the currently selected workbook, whether chosen by click or drop.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Holds the most recent success or error state shown under the form.
  const [status, setStatus] = useState<UploadStatusState | null>(null);
  // Tracks whether the pointer is currently dragging over the dropzone.
  const [isDragging, setIsDragging] = useState(false);
  // Tracks whether an upload request is currently in flight.
  const [isUploading, setIsUploading] = useState(false);
  // Points at the hidden file input so the hook can clear or sync it manually.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Lets the hook navigate to the dashboard after a successful upload.
  const router = useRouter();

  // Clear both the React state and the hidden DOM input so the next upload
  // starts from a clean slate no matter how the previous file was chosen.
  const resetFileInput = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Any new file selection, whether from click-to-browse or drag-and-drop,
  // should replace the previous status so stale success/error messages disappear.
  const handleFileSelection = (file: File | null) => {
    setSelectedFile(file);
    setStatus(null);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Read the first selected file from the hidden input and mirror it into React state.
    const file = event.target.files?.[0] ?? null;
    handleFileSelection(file);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // Prevent the browser from reloading the page on form submit.
    event.preventDefault();

    // Validate locally first so obvious issues never trigger a network request.
    if (!selectedFile) {
      setStatus({
        type: 'error',
        message: UPLOAD_MISSING_FILE_ERROR,
      });
      return;
    }

    const validationError = getFileValidationError(selectedFile);
    if (validationError) {
      setStatus({
        type: 'error',
        message: validationError,
      });
      return;
    }

    setIsUploading(true);
    // Clear any previous status so the UI reflects the current request attempt.
    setStatus(null);

    try {
      // Send the currently selected workbook to the upload API.
      const data = await uploadClassroomSpreadsheet(selectedFile);

      // Reset the field after a successful upload so the next attempt always
      // reflects a fresh file selection and the dashboard navigation feels final.
      setStatus({
        type: 'success',
        message:
          'Upload complete! Your classrooms and assignments are updated.',
        counts: data.counts,
        filePath: data.filePath,
      });
      resetFileInput();
      // Send the user to the dashboard after the upload succeeds.
      router.push('/dashboard');
    } catch (error) {
      // Show either the thrown API message or the shared unexpected fallback.
      setStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : UPLOAD_UNEXPECTED_ERROR,
      });
    } finally {
      // Always clear the loading flag, whether the request succeeded or failed.
      setIsUploading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    // Prevent the browser from trying to open the dropped file directly.
    event.preventDefault();
    // Leaving the drop target clears the highlighted drag state.
    setIsDragging((prev) => (prev ? false : prev));

    // The browser can deliver multiple dropped files, but this flow only accepts
    // the first workbook and ignores the rest.
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
      if (fileInputRef.current) {
        // Try to keep the hidden input in sync with the dropped file for form consistency.
        const synced = syncDroppedFilesToInput(
          fileInputRef.current,
          event.dataTransfer.files
        );
        if (!synced) {
          // Keep input and state aligned if programmatic FileList assignment fails.
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    // Keep drag state transitions cheap so repeated dragover events do not
    // cause needless React updates while the pointer moves around the dropzone.
    setIsDragging((prev) => (prev ? prev : true));
  };

  const onDragLeave = () => {
    // Reset the highlighted dropzone state when the pointer leaves the label.
    setIsDragging((prev) => (prev ? false : prev));
  };

  // Disable submit when there is no file to send or while a request is running.
  const isSubmitDisabled = !selectedFile || isUploading;

  return {
    // Expose the hidden input ref to the presentational dropzone component.
    fileInputRef,
    // Expose the selected file so the UI can show its name.
    selectedFile,
    // Expose the latest status so the status component can render it.
    status,
    // Expose drag state so the dropzone can switch visual styles.
    isDragging,
    // Expose upload state so the submit button can show loading text.
    isUploading,
    // Expose drag-leave handler for the dropzone label.
    onDragLeave,
    // Expose drag-over handler for the dropzone label.
    onDragOver,
    // Expose drop handler for the dropzone label.
    onDrop,
    // Expose change handler for the hidden file input.
    onInputChange,
    // Expose submit handler for the form element.
    onSubmit,
    // Expose submit-disabled state for the button.
    isSubmitDisabled,
  };
}
