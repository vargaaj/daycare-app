'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  getFileValidationError,
  UPLOAD_MISSING_FILE_ERROR,
  UPLOAD_UNEXPECTED_ERROR,
} from '@/lib/upload/shared';
import { uploadClassroomSpreadsheet } from '@/lib/upload/uploadClient';
import type { UploadSuccessCounts } from '@/types/upload';

export type UploadStatusState =
  | {
      type: 'success';
      message: string;
      counts: UploadSuccessCounts;
      filePath: string;
    }
  | { type: 'error'; message: string };

const setInputFiles = (input: HTMLInputElement, files: FileList) => {
  try {
    input.files = files;
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Unable to sync dropped files to hidden input; continuing with selected file state.',
        error
      );
    }
    return false;
  }
};

export function useUploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatusState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

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

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleFileSelection(file);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setStatus({
        type: 'error',
        message: UPLOAD_MISSING_FILE_ERROR,
      });
      return;
    }

    const validationError = getFileValidationError(selectedFile);
    if (validationError) {
      setStatus({
        type: 'error',
        message: validationError,
      });
      return;
    }

    setIsUploading(true);
    setStatus(null);

    try {
      const data = await uploadClassroomSpreadsheet(selectedFile);

      setStatus({
        type: 'success',
        message:
          'Upload complete! Your classrooms and assignments are updated.',
        counts: data.counts,
        filePath: data.filePath,
      });
      resetFileInput();
      router.push('/dashboard');
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : UPLOAD_UNEXPECTED_ERROR,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging((prev) => (prev ? false : prev));

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
      if (fileInputRef.current) {
        const synced = setInputFiles(
          fileInputRef.current,
          event.dataTransfer.files
        );
        if (!synced) {
          // Keep input and state aligned if programmatic FileList assignment fails.
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging((prev) => (prev ? prev : true));
  };

  const onDragLeave = () => {
    setIsDragging((prev) => (prev ? false : prev));
  };

  const selectedFileLabel = selectedFile
    ? selectedFile.name
    : 'Drag and drop your file here';
  const dropzoneToneClasses = isDragging
    ? 'border-indigo-500 bg-indigo-50'
    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50';
  const statusToneClasses =
    status?.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-700';
  const isSubmitDisabled = !selectedFile || isUploading;

  return {
    fileInputRef,
    isUploading,
    onDragLeave,
    onDragOver,
    onDrop,
    onInputChange,
    onSubmit,
    selectedFileLabel,
    dropzoneToneClasses,
    statusToneClasses,
    status,
    isSubmitDisabled,
  };
}
