'use client';

import { useRef, useState } from 'react';
import type { UploadSuccessCounts } from '@/types/upload';

const requiredColumns = [
  'First Name',
  'Last Name',
  'Classroom',
  'Dob',
  'Schedule',
] as const;

type StatusState =
  | {
      type: 'success';
      message: string;
      counts: UploadSuccessCounts;
      filePath: string;
    }
  | { type: 'error'; message: string };

export function UploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFileInput = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelection = (file: File | null) => {
    setSelectedFile(file);
    setStatus(null);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleFileSelection(file);
  };

  const validateFileType = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setStatus({
        type: 'error',
        message: 'Only .xlsx files are supported.',
      });
      return false;
    }
    return true;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setStatus({
        type: 'error',
        message: 'Please select a file to upload.',
      });
      return;
    }

    if (!validateFileType(selectedFile)) {
      return;
    }

    setIsUploading(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/upload/api', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as
        | { success: true; filePath: string; counts: UploadSuccessCounts }
        | { success: false; error?: string }
        | null;

      console.log(data);

      if (!response.ok || !data || data.success !== true) {
        const message =
          (data && 'error' in data && data.error) ||
          'We could not process your upload. Please try again.';
        throw new Error(message);
      }

      setStatus({
        type: 'success',
        message:
          'Upload complete! Your classrooms and assignments are updated.',
        counts: data.counts,
        filePath: data.filePath,
      });
      resetFileInput();
    } catch (error) {
      console.error('Upload error:', error);
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong during the upload.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = event.dataTransfer.files;
      }
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

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
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
          }`}
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
            {selectedFile ? selectedFile.name : 'Drag and drop your file here'}
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
        disabled={!selectedFile || isUploading}
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
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
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
            {requiredColumns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          <div className="grid grid-cols-5 px-3 py-2 text-slate-600">
            <span>Avery</span>
            <span>Johnson</span>
            <span>Toddlers</span>
            <span>2019-03-14</span>
            <span>Mon-Fri 8am-4pm</span>
          </div>
        </div>
      </div>
    </form>
  );
}
