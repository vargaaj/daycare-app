import type { Metadata } from 'next';
import { ClassroomConfigurationForm } from '@/components/configuration/ClassroomConfigurationForm';

export const metadata: Metadata = {
  title: 'Configure Classrooms | Daycare Optimizer',
  description:
    'Set up your daycare classrooms before uploading your roster to get personalized optimization insights.',
};

export default function ConfigurePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-100 py-28">
      <section className="px-4">
        <ClassroomConfigurationForm />
      </section>
    </div>
  );
}

