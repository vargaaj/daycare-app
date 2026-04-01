// Represents one normalized child row after the workbook parser has trimmed
// strings, validated required fields, and converted the DOB into ISO format.
export type WorksheetChildRow = {
  // The child's given name from the spreadsheet.
  firstName: string;
  // The child's family name from the spreadsheet.
  lastName: string;
  // The classroom name exactly as the workbook provided it after trimming.
  classroom: string;
  // The child's date of birth normalized to `YYYY-MM-DD`.
  dob: string;
  // The raw schedule string that will be stored on the assignment row.
  schedule: string;
};

// Summarizes how many records the upload pipeline created or processed so the
// UI can show a compact success summary after the request completes.
export type UploadSuccessCounts = {
  // Number of child records inserted during the overwrite import.
  childrenCreated: number;
  // Reserved for future reuse behavior; currently always zero for full overwrite uploads.
  childrenReused: number;
  // Number of classroom assignment rows written for the current month.
  assignmentsProcessed: number;
};

// Captures the two status shapes the client hook can render after a submit:
// either an error message or a success summary with counts and storage path.
export type UploadStatusState =
  | {
      // Marks the status as a successful upload.
      type: 'success';
      // User-facing success message shown in the form.
      message: string;
      // Summary counts returned by the API.
      counts: UploadSuccessCounts;
      // Stored file path returned by the API.
      filePath: string;
    }
  | {
      // Marks the status as a failed upload.
      type: 'error';
      // User-facing error message shown in the form.
      message: string;
    };

// Successful `/upload/api` response body.
export type UploadSuccessResponse = {
  // Distinguishes the success shape from the error shape.
  success: true;
  // Storage path where the raw uploaded workbook was persisted.
  filePath: string;
  // Summary counts used by the success UI.
  counts: UploadSuccessCounts;
};

// Failed `/upload/api` response body.
export type UploadErrorResponse = {
  // Distinguishes the error shape from the success shape.
  success: false;
  // User-facing error message chosen by the route or helper that failed.
  error: string;
};
