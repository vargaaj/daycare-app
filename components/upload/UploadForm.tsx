'use client';

// Presentational dropzone for file picking and drag state.
import { Dropzone } from '@/components/upload/Dropzone';
// Presentational preview of the required upload columns.
import { RequiredColumnsPreview } from '@/components/upload/RequiredColumnsPreview';
// Presentational success/error panel for upload results.
import { UploadStatus } from '@/components/upload/UploadStatus';
// Hook that owns the upload workflow state and handlers.
import { useUploadForm } from '@/components/upload/useUploadForm';

/**
 * Composes the upload page UI from small presentational pieces while keeping
 * the workflow logic inside the upload hook.
 */
export function UploadForm() {
  // Pull the state and handlers needed to wire the presentational pieces together.
  const {
    fileInputRef,
    selectedFile,
    status,
    isDragging,
    isSubmitDisabled,
    isUploading,
    onDragLeave,
    onDragOver,
    onDrop,
    onInputChange,
    onSubmit,
  } = useUploadForm();

  return (
    <form
      // Delegate submit behavior to the hook so this component stays declarative.
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-md"
    >
      <h1 className="text-2xl font-semibold text-slate-900">
        Upload Classroom Data
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Upload your daycare roster as an Excel spreadsheet. We&apos;ll store the
        file securely and sync children, classrooms, and assignments for this
        month.
      </p>

      {/* File picking and drag state live in the hook; the dropzone only renders them. */}
      <Dropzone
        fileInputRef={fileInputRef}
        selectedFile={selectedFile}
        isDragging={isDragging}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onInputChange={onInputChange}
      />

      <button
        // Submit the current workbook selection to the upload route.
        type="submit"
        className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
        // Disable the button while no file is selected or an upload is already running.
        disabled={isSubmitDisabled}
      >
        {/* Swap the label while the request is in flight so the user sees immediate feedback. */}
        {isUploading ? 'Uploading...' : 'Upload Spreadsheet'}
      </button>

      <div className="mt-4 text-sm text-slate-600">
        Need a template?{' '}
        <a
          // Link to the bundled workbook template so users can download the expected format.
          href="/templates/classroom_template.xlsx"
          download
          className="font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Download the Excel sample
        </a>
        .
      </div>

      {/* Status is rendered separately so the form stays mostly composition-only. */}
      {status ? <UploadStatus status={status} /> : null}

      {/* Keep the required-column contract visible without mixing that markup into the form workflow. */}
      <RequiredColumnsPreview />
    </form>
  );
}
