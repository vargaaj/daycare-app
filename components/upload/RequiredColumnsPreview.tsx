'use client';

// Shared ordered list of headers required by the workbook parser.
import { UPLOAD_REQUIRED_COLUMNS } from '@/lib/upload/shared';

/**
 * Keeps the spreadsheet contract visible next to the form so users can fix
 * formatting issues before they upload.
 */
export function RequiredColumnsPreview() {
  return (
    <div className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
      {/* Headline that tells the user what this preview block represents. */}
      <p className="font-semibold text-slate-900">Required columns:</p>
      {/* Show both the required headers and one realistic sample row so users can
          compare their spreadsheet against the expected shape at a glance. */}
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-[11px] sm:text-xs">
        <div className="grid grid-cols-5 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
          {/* Render the canonical header order used by the parser. */}
          {UPLOAD_REQUIRED_COLUMNS.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="grid grid-cols-5 px-3 py-2 text-slate-600">
          {/* Example row values that demonstrate the expected formatting. */}
          <span>Avery</span>
          <span>Johnson</span>
          <span>Toddlers</span>
          <span>2019-03-14</span>
          <span>M,W,Th,F</span>
        </div>
      </div>
    </div>
  );
}
