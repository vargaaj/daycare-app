'use client';

// Event and ref types used by the dropzone props.
import type { ChangeEvent, DragEvent, RefObject } from 'react';

// Props required to render the dropzone while keeping the actual state in the hook.
type DropzoneProps = {
  // Ref for the hidden file input element.
  fileInputRef: RefObject<HTMLInputElement | null>;
  // Currently selected file so the UI can show its name.
  selectedFile: File | null;
  // Drag-state flag used to switch styles while hovering with a file.
  isDragging: boolean;
  // Drop handler provided by the hook.
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  // Drag-over handler provided by the hook.
  onDragOver: (event: DragEvent<HTMLLabelElement>) => void;
  // Drag-leave handler provided by the hook.
  onDragLeave: () => void;
  // Input-change handler provided by the hook.
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Renders the upload-specific drag-and-drop affordance while leaving file
 * selection state and submit behavior in the upload hook.
 */
export function Dropzone({
  fileInputRef,
  selectedFile,
  isDragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onInputChange,
}: DropzoneProps) {
  // Keep the copy close to the rendered state so the hook can stay focused on
  // behavior instead of presentation details.
  const selectedFileLabel = selectedFile
    ? selectedFile.name
    : 'Drag and drop your file here';
  // Swap the border/background styles when a drag is active over the label.
  const dropzoneToneClasses = isDragging
    ? 'border-indigo-500 bg-indigo-50'
    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50';

  return (
    <div className="mt-6">
      <label
        // Associate the large click target with the hidden input below.
        htmlFor="file-upload"
        // Let the hook consume dropped files.
        onDrop={onDrop}
        // Let the hook know when the pointer is hovering with a draggable file.
        onDragOver={onDragOver}
        // Let the hook clear the drag highlight when the pointer leaves.
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
        // Wire the hidden input back to the hook-managed ref.
        ref={fileInputRef}
        id="file-upload"
        name="file-upload"
        type="file"
        // Restrict the browser picker to `.xlsx` files.
        accept=".xlsx"
        // Mirror click-to-browse selections back into hook state.
        onChange={onInputChange}
        // Keep the input visually hidden because the label is the designed control.
        className="sr-only"
      />
    </div>
  );
}
