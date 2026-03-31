'use client';

import { UPLOAD_REQUIRED_COLUMNS } from '@/lib/upload/shared';
import { useUploadForm } from '@/components/upload/useUploadForm';

export function UploadForm() {
  const {
    fileInputRef,
    isSubmitDisabled,
    isUploading,
    onDragLeave,
    onDragOver,
    onDrop,
    onInputChange,
    onSubmit,
    selectedFileLabel,
    dropzoneToneClasses,
    status,
    statusToneClasses,
  } = useUploadForm();

  return (
    <form
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

      <div className="mt-6">
        <label
          htmlFor="file-upload"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition ${dropzoneToneClasses}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-12 w-12 text-indigo-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 15.75A4.5 4.5 0 017.5 11.25h2.278a2.25 2.25 0 001.735-.81l1.531-1.838a2.25 2.25 0 013.409 0l1.531 1.838a2.25 2.25 0 001.735.81H19.5a1.5 1.5 0 011.5 1.5v1.125A2.625 2.625 0 0118.375 18h-12A3.375 3.375 0 013 14.625v1.125z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18h7.5m-4.5-4.5v4.5m3-4.5v4.5"
            />
          </svg>
          <span className="mt-4 text-sm font-medium text-slate-900">
            {selectedFileLabel}
          </span>
          <span className="mt-2 text-xs text-slate-500">
            Only .xlsx files are supported
          </span>
          <span className="mt-3 inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            Choose file
          </span>
        </label>
        <input
          ref={fileInputRef}
          id="file-upload"
          name="file-upload"
          type="file"
          accept=".xlsx"
          onChange={onInputChange}
          className="sr-only"
        />
      </div>

      <button
        type="submit"
        className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
        disabled={isSubmitDisabled}
      >
        {isUploading ? 'Uploading...' : 'Upload Spreadsheet'}
      </button>

      <div className="mt-4 text-sm text-slate-600">
        Need a template?{' '}
        <a
          href="/templates/classroom_template.xlsx"
          download
          className="font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Download the Excel sample
        </a>
        .
      </div>

      {status && (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${statusToneClasses}`}
        >
          <p className="font-semibold">{status.message}</p>
          {status.type === 'success' ? (
            <div className="mt-3 space-y-1 text-xs text-emerald-700">
              <p>Stored file path: {status.filePath}</p>
              <p>
                {' '}
                | Children added: {status.counts.childrenCreated} | Children
                reused: {status.counts.childrenReused} | Assignments processed:{' '}
                {status.counts.assignmentsProcessed}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-900">Required columns:</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-[11px] sm:text-xs">
          <div className="grid grid-cols-5 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
            {UPLOAD_REQUIRED_COLUMNS.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          <div className="grid grid-cols-5 px-3 py-2 text-slate-600">
            <span>Avery</span>
            <span>Johnson</span>
            <span>Toddlers</span>
            <span>2019-03-14</span>
            <span>M,W,Th,F</span>
          </div>
        </div>
      </div>
    </form>
  );
}
