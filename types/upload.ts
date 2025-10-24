export type WorksheetChildRow = {
  firstName: string;
  lastName: string;
  classroom: string;
  dob: string;
  schedule: string;
};

export type UploadSuccessCounts = {
  childrenCreated: number;
  childrenReused: number;
  assignmentsProcessed: number;
};

export type UploadSuccessResponse = {
  success: true;
  filePath: string;
  counts: UploadSuccessCounts;
};

export type UploadErrorResponse = {
  success: false;
  error: string;
};
