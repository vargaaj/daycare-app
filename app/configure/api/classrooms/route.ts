import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type {
  ClassroomRequestPayload,
  ClassroomSubmission,
} from '@/types/classroom';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Supabase credentials are not configured.' },
      { status: 500 }
    );
  }

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

  try {
    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/classroom_info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(rows),
      }
    );

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      return NextResponse.json(
        {
          error:
            errorText ||
            'Supabase refused the request. Please try again or contact support.',
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Supabase request failed', error);
    return NextResponse.json(
      { error: 'Unable to reach Supabase at the moment.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
