import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import type {
  ClassroomRecord,
  ClassroomRequestPayload,
  ClassroomSubmission,
} from '@/types/classroom';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

const isValidPayload = (
  payload: unknown
): payload is ClassroomRequestPayload => {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as ClassroomRequestPayload).classrooms)
  ) {
    return false;
  }

  const { classrooms } = payload as ClassroomRequestPayload;

  if (classrooms.length === 0) {
    return false;
  }

  return classrooms.every((classroom) => {
    if (!classroom || typeof classroom !== 'object') {
      return false;
    }

    const { name, age_range, capacity } = classroom as ClassroomSubmission;

    return (
      typeof name === 'string' &&
      name.trim().length > 0 &&
      typeof age_range === 'string' &&
      age_range.trim().length > 0 &&
      Number.isInteger(capacity) &&
      capacity > 0
    );
  });
};

export async function POST(request: Request) {
  const user = await auth();
  const userId = user.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json(
      { error: 'Invalid classroom payload.' },
      { status: 400 }
    );
  }

  const rows = body.classrooms.map((classroom) => ({
    user_id: userId,
    name: classroom.name.trim(),
    age_range: classroom.age_range.trim(),
    capacity: classroom.capacity,
  }));

  const { error } = await supabase.from('classrooms').insert(rows);

  if (error) {
    console.error('Supabase request failed', error);
    return NextResponse.json(
      {
        error:
          'We could not save your classrooms right now. Please try again in a moment.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('classrooms')
    .select('id, name, age_range, capacity')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load classrooms', error);
    return NextResponse.json(
      { error: 'Failed to load classrooms.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    classrooms: (data ?? []) as ClassroomRecord[],
  });
}

export async function DELETE(request: Request) {
  const user = await auth();
  const userId = user.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('id');

  if (!classroomId) {
    return NextResponse.json(
      { error: 'Missing classroom identifier.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from('classrooms')
    .delete()
    .eq('id', classroomId)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete classroom', error);
    return NextResponse.json(
      { error: 'We could not remove that classroom. Please try again later.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
