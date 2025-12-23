import type { SupabaseClient } from '@supabase/supabase-js';

type DayKey = 'M' | 'T' | 'W' | 'Th' | 'F';

type ClassroomRecord = {
  id: string;
  name: string;
  age_range: string | null;
  capacity: number | null;
};

type ClassroomNormalized = {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  capacity: number;
};

type ChildRecord = {
  id: string;
  dob: string;
};

type BaseAssignment = {
  child_id: string;
  classroom_id: string | null;
  schedule: string | null;
};

type AssignmentInsert = {
  child_id: string;
  classroom_id: string | null;
  month: string;
  schedule: string;
  user_id: string;
};

const pad = (value: number) => value.toString().padStart(2, '0');

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

  const finalYear = startMonth >= 8 ? startYear + 1 : startYear; // September (8) or later goes to next year's August
  const finalDate = new Date(finalYear, 7, 1); // August

  const months: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1); // month after upload/current
  while (cursor <= finalDate) {
    months.push(monthKeyWithDay(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
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

const expandRangeIfPresent = (text: string): DayKey[] | null => {
  const normalized = text.toLowerCase();
  if (/mon\s*-\s*fri|\bm\s*-\s*f\b/.test(normalized)) {
    return ['M', 'T', 'W', 'Th', 'F'];
  }
  return null;
};

const parseScheduleDays = (schedule: string | null | undefined): DayKey[] => {
  if (!schedule) return [];
  const range = expandRangeIfPresent(schedule);
  if (range) return range;

  const normalized = schedule.toLowerCase().replace(/[^a-z]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
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

const sortChildren = (
  a: { eligibleCount: number; ageMonths: number; dayCount: number; id: string },
  b: { eligibleCount: number; ageMonths: number; dayCount: number; id: string }
) => {
  if (a.eligibleCount !== b.eligibleCount)
    return a.eligibleCount - b.eligibleCount;
  if (a.ageMonths !== b.ageMonths) return b.ageMonths - a.ageMonths;
  if (a.dayCount !== b.dayCount) return b.dayCount - a.dayCount;
  return a.id.localeCompare(b.id);
};

type OptimizeOptions = {
  horizonMonths?: number; // legacy; unused
  currentMonthOverride?: string; // yyyy-mm-dd string aligned to DB storage
};

export async function optimizeFutureClassrooms(
  supabase: SupabaseClient,
  userId: string,
  options: OptimizeOptions = {}
) {
  const today = new Date();
  const currentMonthKey =
    options.currentMonthOverride ??
    monthKeyWithDay(new Date(today.getFullYear(), today.getMonth(), 1));

  const [classroomsRes, childrenRes, baseAssignmentsRes] = await Promise.all([
    supabase
      .from('classrooms')
      .select('id, name, age_range, capacity')
      .eq('user_id', userId),
    supabase.from('children').select('id, dob').eq('user_id', userId),
    supabase
      .from('classroom_assignments')
      .select('child_id, classroom_id, schedule')
      .eq('user_id', userId)
      .eq('month', currentMonthKey),
  ]);

  if (classroomsRes.error) throw classroomsRes.error;
  if (childrenRes.error) throw childrenRes.error;
  if (baseAssignmentsRes.error) throw baseAssignmentsRes.error;

  const classrooms: ClassroomNormalized[] = (classroomsRes.data ?? [])
    .map((row: ClassroomRecord) => {
      const parsed = parseAgeRange(row.age_range);
      if (!parsed || typeof row.capacity !== 'number' || row.capacity <= 0)
        return null;
      return {
        id: row.id,
        name: row.name,
        minAgeMonths: parsed.min,
        maxAgeMonths: parsed.max,
        capacity: row.capacity,
      };
    })
    .filter(Boolean) as ClassroomNormalized[];

  if (classrooms.length === 0) {
    return; // nothing to optimize
  }

  const maxAge = Math.max(...classrooms.map((c) => c.maxAgeMonths));
  const oldestClassrooms = classrooms
    .filter((c) => c.maxAgeMonths === maxAge)
    .map((c) => c.id);
  const maxAgeByClassroom = new Map<string, number>();
  classrooms.forEach((c) => maxAgeByClassroom.set(c.id, c.maxAgeMonths));

  const children: ChildRecord[] = childrenRes.data ?? [];
  const baseAssignments: BaseAssignment[] = baseAssignmentsRes.data ?? [];
  const baseByChild = new Map<string, BaseAssignment>();
  baseAssignments.forEach((row) => baseByChild.set(row.child_id, row));

  const highestMaxAgeByChild = new Map<string, number>();
  baseAssignments.forEach((a) => {
    if (a.classroom_id) {
      const classMax = maxAgeByClassroom.get(a.classroom_id);
      if (typeof classMax === 'number') {
        highestMaxAgeByChild.set(a.child_id, classMax);
      }
    }
  });

  const targetMonths = generateThroughSchoolYear(currentMonthKey);
  let previousMonthAssignments = baseByChild;

  for (const month of targetMonths) {
    // Skip if assignments already exist for this user/month (preserve history)
    const existingCheck = await supabase
      .from('classroom_assignments')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .eq('month', month);
    if (!existingCheck.error && (existingCheck.count ?? 0) > 0) {
      // Seed previousMonthAssignments from existing rows for next iteration
      const { data: existingRows } = await supabase
        .from('classroom_assignments')
        .select('child_id, classroom_id, schedule')
        .eq('user_id', userId)
        .eq('month', month);
      if (existingRows) {
        const nextPrev = new Map<string, BaseAssignment>();
        existingRows.forEach((r) => {
          nextPrev.set(r.child_id, {
            child_id: r.child_id,
            classroom_id: r.classroom_id,
            schedule: r.schedule,
          });
        });
        previousMonthAssignments = nextPrev;
      }
      continue;
    }

    const monthDate = parseMonthKey(month);

    // enrollment counters per classroom/day
    const enrolled: Record<string, Record<DayKey, number>> = {};
    classrooms.forEach((c) => {
      enrolled[c.id] = { M: 0, T: 0, W: 0, Th: 0, F: 0 };
    });

    const childMeta = children.map((child) => {
      const prev = previousMonthAssignments.get(child.id);
      const days = parseScheduleDays(prev?.schedule ?? '');
      const ageMonths = ageInMonthsOn(child.dob, monthDate);
      const highestReached =
        highestMaxAgeByChild.get(child.id) ??
        (prev?.classroom_id
          ? maxAgeByClassroom.get(prev.classroom_id) ?? 0
          : 0);
      return {
        child,
        days,
        ageMonths,
        currentClassroomId: prev?.classroom_id ?? null,
        highestReached,
      };
    });

    // eligible classrooms per child
    const eligibleByChild = new Map<string, ClassroomNormalized[]>();
    childMeta.forEach((meta) => {
      const eligible = classrooms.filter(
        (c) =>
          meta.ageMonths >= c.minAgeMonths &&
          meta.ageMonths <= c.maxAgeMonths &&
          c.maxAgeMonths >= meta.highestReached
      );

      const isAtOldest =
        meta.highestReached >= maxAge ||
        (meta.currentClassroomId &&
          oldestClassrooms.includes(meta.currentClassroomId));

      const filtered = isAtOldest
        ? eligible.filter((c) => oldestClassrooms.includes(c.id))
        : eligible;

      eligibleByChild.set(meta.child.id, filtered);
    });

    // Stability-first: lock children who can stay put
    const locked: AssignmentInsert[] = [];
    const movableMeta: typeof childMeta = [];

    const lockOrder = [...childMeta].sort((a, b) => {
      if (a.ageMonths !== b.ageMonths) return b.ageMonths - a.ageMonths;
      if (a.days.length !== b.days.length) return b.days.length - a.days.length;
      return a.child.id.localeCompare(b.child.id);
    });

    for (const meta of lockOrder) {
      const days = meta.days;
      const eligible = eligibleByChild.get(meta.child.id) ?? [];
      if (
        !meta.currentClassroomId ||
        !days ||
        days.length === 0 ||
        eligible.length === 0
      ) {
        movableMeta.push(meta);
        continue;
      }
      const currentClassroom = eligible.find(
        (c) => c.id === meta.currentClassroomId
      );
      if (!currentClassroom) {
        movableMeta.push(meta);
        continue;
      }
      const fits = days.every(
        (d) => enrolled[currentClassroom.id][d] + 1 <= currentClassroom.capacity
      );
      if (!fits) {
        movableMeta.push(meta);
        continue;
      }
      locked.push({
        child_id: meta.child.id,
        classroom_id: currentClassroom.id,
        month,
        schedule: days.join(','),
        user_id: userId,
      });
      const assignedMax = maxAgeByClassroom.get(currentClassroom.id);
      if (typeof assignedMax === 'number') {
        const prev = highestMaxAgeByChild.get(meta.child.id) ?? 0;
        if (assignedMax > prev) {
          highestMaxAgeByChild.set(meta.child.id, assignedMax);
        }
      }
      days.forEach((d) => {
        enrolled[currentClassroom.id][d] += 1;
      });
    }

    // Movable children sorted by difficulty
    const sortedChildren = movableMeta
      .map((meta) => {
        const eligible = eligibleByChild.get(meta.child.id) ?? [];
        return {
          meta,
          sortKey: {
            eligibleCount: eligible.length,
            ageMonths: meta.ageMonths,
            dayCount: meta.days.length,
            id: meta.child.id,
          },
        };
      })
      .sort((a, b) => sortChildren(a.sortKey, b.sortKey));

    const results: AssignmentInsert[] = [...locked];

    for (const entry of sortedChildren) {
      const meta = entry.meta;
      const days = meta.days;
      const eligible = eligibleByChild.get(meta.child.id) ?? [];

      if (!days || days.length === 0 || eligible.length === 0) {
        results.push({
          child_id: meta.child.id,
          classroom_id: null,
          month,
          schedule: '',
          user_id: userId,
        });
        continue;
      }

      let best: { classroom: ClassroomNormalized | null; score: number } = {
        classroom: null,
        score: Number.POSITIVE_INFINITY,
      };

      for (const classroom of eligible) {
        const fits = days.every(
          (d) => enrolled[classroom.id][d] + 1 <= classroom.capacity
        );
        if (!fits) continue;
        const score = days.reduce(
          (acc, d) => acc + (classroom.capacity - enrolled[classroom.id][d]),
          0
        );
        if (
          score < best.score ||
          (score === best.score &&
            best.classroom &&
            classroom.id < best.classroom.id)
        ) {
          best = { classroom, score };
        } else if (score < best.score) {
          best = { classroom, score };
        }
      }

      if (!best.classroom) {
        results.push({
          child_id: meta.child.id,
          classroom_id: null,
          month,
          schedule: days.join(','),
          user_id: userId,
        });
        continue;
      }

      results.push({
        child_id: meta.child.id,
        classroom_id: best.classroom.id,
        month,
        schedule: days.join(','),
        user_id: userId,
      });

      const assignedMax = maxAgeByClassroom.get(best.classroom.id);
      if (typeof assignedMax === 'number') {
        const prev = highestMaxAgeByChild.get(meta.child.id) ?? 0;
        if (assignedMax > prev) {
          highestMaxAgeByChild.set(meta.child.id, assignedMax);
        }
      }

      days.forEach((d) => {
        enrolled[best.classroom!.id][d] += 1;
      });
    }

    if (results.length > 0) {
      // Final guard: ensure no classroom exceeds capacity after all assignments
      const capacityGuard: Record<string, Record<DayKey, number>> = {};
      classrooms.forEach((c) => {
        capacityGuard[c.id] = { M: 0, T: 0, W: 0, Th: 0, F: 0 };
      });

      const guardedResults = results.map((r) => {
        if (!r.classroom_id) return r;
        const classCap =
          classrooms.find((c) => c.id === r.classroom_id)?.capacity ?? null;
        if (typeof classCap !== 'number' || classCap <= 0) {
          return { ...r, classroom_id: null };
        }
        const daysList = parseScheduleDays(r.schedule);
        const canFit = daysList.every(
          (d) => capacityGuard[r.classroom_id!][d] + 1 <= classCap
        );
        if (!canFit) {
          return { ...r, classroom_id: null };
        }
        daysList.forEach((d) => {
          capacityGuard[r.classroom_id!][d] += 1;
        });
        return r;
      });

      // Debug log: show enrollment per classroom/day for this month
      // console.log(
      //   'Month enrollment summary',
      //   month,
      //   guardedResults.reduce((acc, r) => {
      //     const classroomId = r.classroom_id;
      //     if (!classroomId) return acc;
      //     const daysList = parseScheduleDays(r.schedule);
      //     if (!acc[classroomId]) {
      //       acc[classroomId] = { M: 0, T: 0, W: 0, Th: 0, F: 0 };
      //     }
      //     daysList.forEach((d) => {
      //       acc[classroomId][d] += 1;
      //     });
      //     return acc;
      //   }, {} as Record<string, Record<DayKey, number>>)
      // );

      const { error: insertError } = await supabase
        .from('classroom_assignments')
        .insert(guardedResults);
      if (insertError) {
        throw insertError;
      }

      const nextPrev = new Map<string, BaseAssignment>();
      guardedResults.forEach((r) => {
        nextPrev.set(r.child_id, {
          child_id: r.child_id,
          classroom_id: r.classroom_id,
          schedule: r.schedule,
        });
      });
      previousMonthAssignments = nextPrev;
    }
  }
}
