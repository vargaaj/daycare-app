import {
  getUploadApiErrorMessage,
} from '@/lib/upload/shared';
import type {
  UploadErrorResponse,
  UploadSuccessResponse,
} from '@/types/upload';

type UploadApiPayload = UploadSuccessResponse | UploadErrorResponse | null;

const isUploadSuccessResponse = (
  value: UploadApiPayload
): value is UploadSuccessResponse =>
  !!value && value.success === true;

export async function uploadClassroomSpreadsheet(
  file: File
): Promise<UploadSuccessResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/upload/api', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as UploadApiPayload;

  if (!response.ok || !isUploadSuccessResponse(payload)) {
    throw new Error(getUploadApiErrorMessage(payload));
  }

  return payload;
}
