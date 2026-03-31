export const UPLOAD_REQUIRED_COLUMNS = [
  'First Name',
  'Last Name',
  'Classroom',
  'Dob',
  'Schedule',
] as const;

export const UPLOAD_FILE_TYPE_ERROR = 'Only .xlsx files are supported.';
export const UPLOAD_MISSING_FILE_ERROR = 'Please select a file to upload.';
export const UPLOAD_PROCESS_ERROR =
  'We could not process your upload. Please try again.';
export const UPLOAD_UNEXPECTED_ERROR =
  'Something went wrong during the upload.';

export const isXlsxFileName = (name: string) =>
  name.toLowerCase().endsWith('.xlsx');

export const getFileValidationError = (file: File) => {
  if (!isXlsxFileName(file.name)) {
    return UPLOAD_FILE_TYPE_ERROR;
  }
  return null;
};

export const getUploadApiErrorMessage = (payload: unknown) => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (error) {
      return String(error);
    }
  }

  return UPLOAD_PROCESS_ERROR;
};
