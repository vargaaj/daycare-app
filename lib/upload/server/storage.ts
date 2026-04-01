// Supabase client type used by the storage helper.
import type { SupabaseClient } from '@supabase/supabase-js';
// Structured upload error used to send storage failures back through the route.
import { UploadRouteError } from '@/lib/upload/server/errors';

// Input shape for the storage helper.
type StoreUploadedWorkbookArgs = {
  // Shared Supabase admin client provided by the route.
  supabase: SupabaseClient;
  // Signed-in user id used to scope the storage path.
  userId: string;
  // Original browser file object received from the upload form.
  file: File;
  // Raw workbook bytes already read from the file object.
  buffer: Buffer;
};

// Removes path separators and unusual characters so the original filename can
// be safely embedded inside a storage object key.
const sanitizeFileName = (name: string) =>
  name.replaceAll('\\', '').replaceAll('/', '').replace(/[^\w.\-]/g, '_');

/**
 * Uploads the raw spreadsheet to Supabase Storage before the database write
 * pipeline runs so the original file is preserved for auditing.
 */
export async function storeUploadedWorkbook({
  supabase,
  userId,
  file,
  buffer,
}: StoreUploadedWorkbookArgs): Promise<string> {
  // Prefix the path with the signed-in user and a timestamp so uploads remain
  // traceable and never clobber each other inside the shared bucket.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // Keep a recognizable version of the original filename in the stored object key.
  const sanitizedName = sanitizeFileName(file.name);
  // Combine the user id, timestamp, and sanitized filename into the final bucket path.
  const storagePath = `uploads/${userId}/${timestamp}_${sanitizedName}`;

  // Upload the same raw bytes the parser consumed so the stored file matches the import exactly.
  const { error } = await supabase.storage.from('uploads').upload(
    storagePath,
    buffer,
    {
      // Prefer the browser-provided content type when available.
      contentType:
        file.type ||
        // Fall back to the standard XLSX content type when the browser leaves it blank.
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Never overwrite an existing object; every upload should get its own timestamped key.
      upsert: false,
    }
  );

  if (error) {
    // Convert the storage-layer failure into the structured error shape the route understands.
    throw new UploadRouteError(
      error.message ||
        'We could not store the uploaded file. Please try again.',
      502
    );
  }

  // The route includes this storage path in the success payload so the UI can
  // show exactly which file was persisted for the upload.
  return storagePath;
}
