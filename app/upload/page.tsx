import type { Metadata } from 'next';
import { UploadForm } from '@/components/upload/UploadForm';

export const metadata: Metadata = {
  title: 'Upload Classroom Data | Daycare Optimizer',
  description:
    'Upload and validate your daycare classroom spreadsheet to start optimizing schedules.',
};

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pt-28 pb-16">
      <section className="px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Upload Classroom Data
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Start your optimizing by uploading your classroom roster. We&apos;ll
            make sure everything is formatted correctly before we get to work.
          </p>
        </div>
        <div className="mt-10">
          <UploadForm />
        </div>
      </section>
    </div>
  );
}
