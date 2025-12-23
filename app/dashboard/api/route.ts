import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type DayKey = 'M' | 'T' | 'W' | 'Th' | 'F';

type IncomingAssignment = {
  childId: string;
  classroomId: string | null;
  days: DayKey[];
};

type IncomingNewChild = {
  tempId: string;
  firstName: string;
  lastName: string;
  dob: string; // ISO date
  classroomId: string | null;
  days: DayKey[];
};

type ChildRow = {
  id: string;
  dob: string;
};

type AssignmentRow = {
  child_id: string;
  classroom_id: string | null;
  schedule: string | null;
};

type AssignmentInsert = {
  child_id: string;
  classroom_id: string | null;
  user_id: string;
  month: string;
  schedule: string;
};

const DAY_KEYS: DayKey[] = ['M', 'T', 'W', 'Th', 'F'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDayKeyArray = (value: unknown): value is DayKey[] =>
  Array.isArray(value) && value.every((v) => DAY_KEYS.includes(v as DayKey));

const isValidPayload = (
  body: unknown
): body is {
  month: string;
  assignments: IncomingAssignment[];
  newChildren?: IncomingNewChild[];
} => {
  if (!isRecord(body)) return false;
  if (typeof body.month !== 'string' || !body.month.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return false;
  }
  if (!Array.isArray(body.assignments)) return false;
  const validAssignments = body.assignments.every((a) => {
    if (!isRecord(a)) return false;
    return (
      typeof a.childId === 'string' &&
      (typeof a.classroomId === 'string' || a.classroomId === null) &&
      isDayKeyArray(a.days)
    );
  });
  if (!validAssignments) return false;
  if (body.newChildren) {
    if (!Array.isArray(body.newChildren)) return false;
    const validNew = body.newChildren.every((c) => {
      if (!isRecord(c)) return false;
      return (
        typeof c.tempId === 'string' &&
        typeof c.firstName === 'string' &&
        typeof c.lastName === 'string' &&
        typeof c.dob === 'string' &&
        (typeof c.classroomId === 'string' || c.classroomId === null) &&
        isDayKeyArray(c.days)
      );
    });
    if (!validNew) return false;
  }
  return true;
};

const parseAgeRange = (
  value: string | null
): { min: number; max: number } | null => {
  if (!value) return null;
  const match = value.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) return null;
  const min = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2], 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
  return { min, max };
};

const parseScheduleDays = (schedule: string | null | undefined): DayKey[] => {
  if (!schedule) return [];
  const normalized = schedule.toLowerCase().replace(/[^a-z]/g, ' ');
  const tokens = normalized.split(/\s+|,/).filter(Boolean);
  const result = new Set<DayKey>();
  tokens.forEach((token) => {
    if (token === 'mon' || token === 'monday' || token === 'm') result.add('M');
    if (
      token === 'tue' ||
      token === 'tues' ||
      token === 'tuesday' ||
      token === 'tu' ||
      token === 't'
    )
      result.add('T');
    if (
      token === 'wed' ||
      token === 'weds' ||
      token === 'wednesday' ||
      token === 'w'
    )
      result.add('W');
    if (
      token === 'thu' ||
      token === 'thur' ||
      token === 'thurs' ||
      token === 'thursday' ||
      token === 'th'
    )
      result.add('Th');
    if (token === 'fri' || token === 'friday' || token === 'f') result.add('F');
    if (token === 'mwf')
      ['M', 'W', 'F'].forEach((d) => result.add(d as DayKey));
    if (token === 'tth' || token === 'tthh')
      ['T', 'Th'].forEach((d) => result.add(d as DayKey));
  });
  return Array.from(result);
};

const sameDays = (a: DayKey[], b: DayKey[]) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const d of b) {
    if (!setA.has(d)) return false;
  }
  return true;
};

const ageInMonthsOn = (dobISO: string, onDate: Date) => {
  const dob = new Date(dobISO);
  let months =
    (onDate.getFullYear() - dob.getFullYear()) * 12 +
    (onDate.getMonth() - dob.getMonth());
  if (onDate.getDate() < dob.getDate()) {
    months -= 1;
  }
  return months;
};

const parseMonthKey = (key: string) => {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  return new Date(year, month, 1);
};

const monthKeyWithDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const generateThroughSchoolYear = (startKey: string) => {
  const start = parseMonthKey(startKey);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth(); // 0-based
  const finalYear = startMonth >= 8 ? startYear + 1 : startYear;
  const finalDate = new Date(finalYear, 7, 1); // August
  const months: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (cursor <= finalDate) {
    months.push(monthKeyWithDay(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
};

export async function POST(request: Request) {
  const user = await auth();
  if (!user || !user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.userId;
  const supabase = getSupabaseAdminClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { month, assignments, newChildren = [] } = body;

  const { data: existingMonthAssignments, error: existingMonthError } =
    await supabase
      .from('classroom_assignments')
      .select('child_id, classroom_id, schedule')
      .eq('user_id', userId)
      .eq('month', month);
  if (existingMonthError) {
    console.error(
      'Failed to load existing month assignments',
      existingMonthError
    );
    return NextResponse.json(
      { error: 'Failed to load assignments' },
      { status: 500 }
    );
  }

  const existingByChild = new Map<string, AssignmentRow>();
  (existingMonthAssignments ?? []).forEach((row) => {
    existingByChild.set(row.child_id, row);
  });

  // Load classrooms (for age/monotonic and capacity)
  const { data: classroomsData, error: classroomsError } = await supabase
    .from('classrooms')
    .select('id, name, age_range, capacity')
    .eq('user_id', userId);
  if (classroomsError) {
    console.error('Failed to load classrooms', classroomsError);
    return NextResponse.json(
      { error: 'Failed to load classrooms' },
      { status: 500 }
    );
  }
  const classrooms = (classroomsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    capacity: typeof c.capacity === 'number' ? c.capacity : null,
    age: parseAgeRange(c.age_range),
  }));

  const tempIdToNewId = new Map<string, string>();
  const newChildRecords: ChildRow[] = [];

  if (newChildren.length > 0) {
    const insertChildren = newChildren.map((c) => ({
      user_id: userId,
      first_name: c.firstName.trim(),
      last_name: c.lastName.trim(),
      dob: c.dob,
    }));

    const { data, error } = await supabase
      .from('children')
      .insert(insertChildren)
      .select('id, dob');

    if (error) {
      console.error('Failed to insert new children', error);
      return NextResponse.json(
        { error: 'Failed to insert children' },
        { status: 500 }
      );
    }

    data?.forEach((child, index) => {
      const temp = newChildren[index];
      if (temp) {
        tempIdToNewId.set(temp.tempId, child.id);
        newChildRecords.push({ id: child.id, dob: child.dob });
      }
    });
  }

  const resolvedAssignments = assignments.map((a) => ({
    child_id: tempIdToNewId.get(a.childId) ?? a.childId,
    classroom_id: a.classroomId,
    user_id: userId,
    month,
    schedule: a.days.join(','),
  }));

  const newChildAssignments = newChildren.map((c) => ({
    child_id: tempIdToNewId.get(c.tempId)!,
    classroom_id: c.classroomId,
    user_id: userId,
    month,
    schedule: c.days.join(','),
  }));

  const allAssignmentsMap = new Map<
    string,
    (typeof resolvedAssignments)[number]
  >();
  resolvedAssignments.forEach((a) => {
    allAssignmentsMap.set(a.child_id, a);
  });
  newChildAssignments.forEach((a) => {
    allAssignmentsMap.set(a.child_id, a);
  });
  const allAssignments = Array.from(allAssignmentsMap.values());

  const changedChildIds = new Set<string>();
  allAssignments.forEach((a) => {
    const prev = existingByChild.get(a.child_id);
    if (!prev) {
      changedChildIds.add(a.child_id);
      return;
    }
    if (prev.classroom_id !== a.classroom_id) {
      changedChildIds.add(a.child_id);
      return;
    }
    const prevDays = parseScheduleDays(prev.schedule);
    const nextDays = parseScheduleDays(a.schedule);
    if (!sameDays(prevDays, nextDays)) {
      changedChildIds.add(a.child_id);
    }
  });

  // Replace current month assignments for this user
  const { error: deleteError } = await supabase
    .from('classroom_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('month', month);
  if (deleteError) {
    console.error('Failed to clear assignments for month', deleteError);
    return NextResponse.json(
      { error: 'Failed to reset assignments' },
      { status: 500 }
    );
  }

  if (allAssignments.length > 0) {
    const { error: insertError } = await supabase
      .from('classroom_assignments')
      .insert(allAssignments);
    if (insertError) {
      console.error('Failed to insert assignments', insertError);
      return NextResponse.json(
        { error: 'Failed to save assignments' },
        { status: 500 }
      );
    }
  }

  // Project new or changed children forward (single-child projection)
  const childIdsToProject = new Set<string>([
    ...Array.from(changedChildIds),
    ...newChildRecords.map((c) => c.id),
  ]);

  if (childIdsToProject.size > 0) {
    console.log('Projecting updated children', {
      month,
      changedChildIds: Array.from(changedChildIds),
      newChildIds: newChildRecords.map((c) => c.id),
    });
    const targetMonths = generateThroughSchoolYear(month);
    if (targetMonths.length > 0) {
      const maxAge = Math.max(
        ...classrooms.map((c) => (c.age ? c.age.max : 0))
      );
      const oldestClassrooms = classrooms
        .filter((c) => c.age && c.age.max === maxAge)
        .map((c) => c.id);
      const maxAgeByClassroom = new Map<string, number>();
      classrooms.forEach((c) => {
        if (c.age) maxAgeByClassroom.set(c.id, c.age.max);
      });

      const existingChildIds = Array.from(childIdsToProject).filter(
        (id) => !newChildRecords.find((c) => c.id === id)
      );
      const { data: existingChildrenRows, error: childrenFetchError } =
        existingChildIds.length > 0
          ? await supabase
              .from('children')
              .select('id, dob')
              .eq('user_id', userId)
              .in('id', existingChildIds)
          : { data: [], error: null };
      if (childrenFetchError) {
        console.error('Failed to load child records', childrenFetchError);
        return NextResponse.json(
          { error: 'Failed to load child records' },
          { status: 500 }
        );
      }

      const childRecords: ChildRow[] = [
        ...newChildRecords,
        ...(existingChildrenRows ?? []),
      ];
      const childDobById = new Map<string, string>();
      childRecords.forEach((c) => childDobById.set(c.id, c.dob));

      const { data: historyAssignments } = await supabase
        .from('classroom_assignments')
        .select('child_id, classroom_id')
        .eq('user_id', userId)
        .in('child_id', Array.from(childIdsToProject))
        .lte('month', month);

      const highestReachedByChild = new Map<string, number>();
      (historyAssignments ?? []).forEach((row) => {
        if (!row.classroom_id) return;
        const classMax = maxAgeByClassroom.get(row.classroom_id);
        if (typeof classMax !== 'number') return;
        const prev = highestReachedByChild.get(row.child_id) ?? 0;
        if (classMax > prev) highestReachedByChild.set(row.child_id, classMax);
      });

      allAssignments.forEach((a) => {
        if (!a.classroom_id) return;
        const classMax = maxAgeByClassroom.get(a.classroom_id);
        if (typeof classMax !== 'number') return;
        const prev = highestReachedByChild.get(a.child_id) ?? 0;
        if (classMax > prev) highestReachedByChild.set(a.child_id, classMax);
      });

      const { data: futureAssignments } = await supabase
        .from('classroom_assignments')
        .select('child_id, classroom_id, schedule, month')
        .eq('user_id', userId)
        .in('month', targetMonths);

      const baselineCounts = new Map<
        string,
        Record<string, Record<DayKey, number>>
      >();
      targetMonths.forEach((m) => {
        baselineCounts.set(m, {});
      });

      (futureAssignments ?? []).forEach((a) => {
        if (childIdsToProject.has(a.child_id)) return;
        if (!a.classroom_id) return;
        const monthBucket = baselineCounts.get(a.month);
        if (!monthBucket) return;
        if (!monthBucket[a.classroom_id]) {
          monthBucket[a.classroom_id] = { M: 0, T: 0, W: 0, Th: 0, F: 0 };
        }
        const days = parseScheduleDays(a.schedule);
        days.forEach((d) => {
          monthBucket[a.classroom_id][d] += 1;
        });
      });

      for (const childId of childIdsToProject) {
        const dob = childDobById.get(childId);
        if (!dob) continue;
        const currentAssign = allAssignments.find(
          (a) => a.child_id === childId
        );
        if (!currentAssign) continue;

        const scheduleDays = parseScheduleDays(currentAssign.schedule);
        let highestReached = highestReachedByChild.get(childId) ?? 0;
        let prevClassroomId = currentAssign.classroom_id;

        const payload: AssignmentInsert[] = [];

        if (!currentAssign.classroom_id) {
          targetMonths.forEach((targetMonth) => {
            payload.push({
              child_id: childId,
              classroom_id: null,
              user_id: userId,
              month: targetMonth,
              schedule: scheduleDays.join(','),
            });
          });

          const { error: upsertError } = await supabase
            .from('classroom_assignments')
            .upsert(payload, { onConflict: 'child_id,month' });
          if (upsertError) {
            console.error(
              'Failed to upsert projected assignments',
              upsertError
            );
          }
          continue;
        }

        for (const targetMonth of targetMonths) {
          const targetDate = parseMonthKey(targetMonth);
          const ageMonths = ageInMonthsOn(dob, targetDate);
          const monthBucket = baselineCounts.get(targetMonth) ?? {};

          if (scheduleDays.length === 0) {
            payload.push({
              child_id: childId,
              classroom_id: null,
              user_id: userId,
              month: targetMonth,
              schedule: '',
            });
            prevClassroomId = null;
            continue;
          }

          const eligible = classrooms.filter((c) => {
            if (!c.age) return false;
            const inRange = ageMonths >= c.age.min && ageMonths <= c.age.max;
            const monotonic = c.age.max >= highestReached;
            return inRange && monotonic;
          });

          const isAtOldest =
            highestReached >= maxAge ||
            (prevClassroomId && oldestClassrooms.includes(prevClassroomId));
          const filteredEligible = isAtOldest
            ? eligible.filter((c) => oldestClassrooms.includes(c.id))
            : eligible;

          let chosen: string | null = null;

          if (prevClassroomId) {
            const current = filteredEligible.find(
              (c) => c.id === prevClassroomId
            );
            if (current && typeof current.capacity === 'number') {
              const counts = monthBucket[current.id] ?? {
                M: 0,
                T: 0,
                W: 0,
                Th: 0,
                F: 0,
              };
              const fitsCurrent = scheduleDays.every(
                (d) => counts[d] + 1 <= current.capacity!
              );
              if (fitsCurrent) {
                chosen = current.id;
              }
            }
          }

          if (!chosen) {
            let best: { id: string | null; score: number } = {
              id: null,
              score: Infinity,
            };
            for (const c of filteredEligible) {
              if (typeof c.capacity !== 'number') continue;
              const counts = monthBucket[c.id] ?? {
                M: 0,
                T: 0,
                W: 0,
                Th: 0,
                F: 0,
              };
              const fits = scheduleDays.every(
                (d) => counts[d] + 1 <= c.capacity!
              );
              if (!fits) continue;
              const score = scheduleDays.reduce(
                (acc, d) => acc + (c.capacity! - counts[d]),
                0
              );
              if (
                score < best.score ||
                (score === best.score && best.id && c.id < best.id)
              ) {
                best = { id: c.id, score };
              }
            }
            chosen = best.id;
          }

          if (chosen) {
            const counts = monthBucket[chosen] ?? {
              M: 0,
              T: 0,
              W: 0,
              Th: 0,
              F: 0,
            };
            scheduleDays.forEach((d) => {
              counts[d] += 1;
            });
            monthBucket[chosen] = counts;
            const assignedMax = maxAgeByClassroom.get(chosen);
            if (
              typeof assignedMax === 'number' &&
              assignedMax > highestReached
            ) {
              highestReached = assignedMax;
            }
            prevClassroomId = chosen;
          } else {
            prevClassroomId = null;
          }

          payload.push({
            child_id: childId,
            classroom_id: chosen,
            user_id: userId,
            month: targetMonth,
            schedule: scheduleDays.join(','),
          });
        }

        if (payload.length > 0) {
          const { error: upsertError } = await supabase
            .from('classroom_assignments')
            .upsert(payload, { onConflict: 'child_id,month' });
          if (upsertError) {
            console.error(
              'Failed to upsert projected assignments',
              upsertError
            );
          }
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    childIdMap: Object.fromEntries(tempIdToNewId),
  });
}
