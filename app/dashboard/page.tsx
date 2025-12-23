import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { ClassroomDashboard } from '@/components/dashboard/ClassroomDashboard';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const metadata: Metadata = {
  title: 'Classroom Dashboard | Daycare Optimizer',
  description:
    'View classroom capacity, manage monthly assignments, and edit schedules inline.',
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const supabase = getSupabaseAdminClient();

  const [classroomsRes, childrenRes, assignmentsRes] = await Promise.all([
    supabase
      .from('classrooms')
      .select('id, name, age_range, capacity')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('children')
      .select('id, first_name, last_name, dob')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('classroom_assignments')
      .select('child_id, classroom_id, month, schedule')
      .eq('user_id', userId)
      .order('month', { ascending: true }),
  ]);

  if (classroomsRes.error || childrenRes.error || assignmentsRes.error) {
    console.error('Failed to load dashboard data', {
      classroomsError: classroomsRes.error,
      childrenError: childrenRes.error,
      assignmentsError: assignmentsRes.error,
    });
    redirect('/upload');
  }

  const data = {
    classrooms: (classroomsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      ageRange: c.age_range ?? null,
      capacity: typeof c.capacity === 'number' ? c.capacity : null,
    })),
    children: (childrenRes.data ?? []).map((c) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      dob: c.dob,
    })),
    assignments: (assignmentsRes.data ?? []).map((a) => ({
      childId: a.child_id,
      classroomId: a.classroom_id,
      month: a.month,
      schedule: a.schedule,
    })),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 py-28">
      <ClassroomDashboard data={data} />
    </div>
  );
}

