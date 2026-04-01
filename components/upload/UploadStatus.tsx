'use client';

// Shared upload status union produced by the hook.
import type { UploadStatusState } from '@/types/upload';

// Props required to render the latest upload outcome.
type UploadStatusProps = {
  // Current upload status, either success with metadata or an error message.
  status: UploadStatusState;
};

/**
 * Shows the latest upload outcome without owning any upload state itself.
 */
export function UploadStatus({ status }: UploadStatusProps) {
  // Success and error states share the same layout, so the component only swaps
  // the accent colors and the extra success-only detail block.
  const statusToneClasses =
    status.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${statusToneClasses}`}>
      {/* Always render the top-level user-facing message first. */}
      <p className="font-semibold">{status.message}</p>
      {status.type === 'success' ? (
        <div className="mt-3 space-y-1 text-xs text-emerald-700">
          {/* Show the storage path returned by the API for confirmation/debugging. */}
          <p>Stored file path: {status.filePath}</p>
          <p>
            {' '}
            {/* Show the same summary counts returned by the upload API. */}
            | Children added: {status.counts.childrenCreated} | Children reused:{' '}
            {status.counts.childrenReused} | Assignments processed:{' '}
            {status.counts.assignmentsProcessed}
          </p>
        </div>
      ) : null}
    </div>
  );
}
