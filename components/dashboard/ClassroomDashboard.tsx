'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Classroom = {
  id: string;
  name: string;
  capacity: number | null;
  ageRange: string | null;
};

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  isNew?: boolean;
};

const DAY_KEYS = ['M', 'T', 'W', 'Th', 'F'] as const;
type DayKey = (typeof DAY_KEYS)[number];

type Assignment = {
  childId: string;
  classroomId: string | null;
  days: DayKey[];
  month: string;
};

type DashboardData = {
  classrooms: Classroom[];
  children: Child[];
  assignments: {
    childId: string;
    classroomId: string | null;
    month: string;
    schedule: string | null;
  }[];
};

type AssignmentsByMonth = Record<string, Assignment[]>;

type Props = {
  data: DashboardData;
};

const padMonth = (value: number) => value.toString().padStart(2, '0');

const firstOfMonthKey = (date: Date) =>
  `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-01`;

const monthKeyFor = (date: Date) => firstOfMonthKey(new Date(date));

const parseMonthKey = (key: string) => {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  return new Date(year, month, 1);
};

const formatMonthLabel = (key: string) => {
  const d = parseMonthKey(key);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const expandRangeIfPresent = (text: string) => {
  const normalized = text.toLowerCase();
  if (/mon\s*-\s*fri|\bm\s*-\s*f\b/.test(normalized)) {
    return ['M', 'T', 'W', 'Th', 'F'] as DayKey[];
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

const ageInMonthsOn = (dobISO: string, monthKey: string) => {
  const dob = new Date(dobISO);
  const target = parseMonthKey(monthKey);
  let months =
    (target.getFullYear() - dob.getFullYear()) * 12 +
    (target.getMonth() - dob.getMonth());
  if (target.getDate() < dob.getDate()) {
    months -= 1;
  }
  return months;
};

const remountKeysByData = new WeakMap<DashboardData, string>();
let remountKeyCounter = 0;

const getRemountKeyForData = (data: DashboardData) => {
  const existing = remountKeysByData.get(data);
  if (existing) return existing;
  remountKeyCounter += 1;
  const key = `dashboard-data-${remountKeyCounter}`;
  remountKeysByData.set(data, key);
  return key;
};

export function ClassroomDashboard({ data }: Props) {
  const remountKey = useMemo(() => getRemountKeyForData(data), [data]);
  return <ClassroomDashboardContent key={remountKey} data={data} />;
}

function ClassroomDashboardContent({ data }: Props) {
  const router = useRouter();
  const [currentMonthKey] = useState(() => firstOfMonthKey(new Date()));

  const assignmentMonths = useMemo(() => {
    const months = data.assignments.map((a) =>
      monthKeyFor(parseMonthKey(a.month))
    );
    return Array.from(new Set(months)).sort();
  }, [data.assignments]);

  const baseMonthKey = useMemo(() => {
    if (assignmentMonths.length === 0) return currentMonthKey;
    return assignmentMonths[0] > currentMonthKey
      ? assignmentMonths[0]
      : currentMonthKey;
  }, [assignmentMonths, currentMonthKey]);

  const monthOptions = useMemo(() => {
    const start = parseMonthKey(baseMonthKey);
    const startYear = start.getFullYear();
    const startMonth = start.getMonth(); // 0-based
    const finalYear = startMonth >= 8 ? startYear + 1 : startYear; // Sep (8) or later -> next year's August
    const finalDate = new Date(finalYear, 7, 1); // August of finalYear

    const options: { key: string; label: string }[] = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= finalDate) {
      const key = monthKeyFor(cursor);
      options.push({ key, label: formatMonthLabel(key) });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return options;
  }, [baseMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const resolvedSelectedMonth = useMemo(
    () => monthOptions.find((m) => m.key === selectedMonth)?.key ?? baseMonthKey,
    [monthOptions, selectedMonth, baseMonthKey]
  );
  const [classrooms, setClassrooms] = useState<Classroom[]>(data.classrooms);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(
    data.classrooms[0]?.id ?? ''
  );
  const [children, setChildren] = useState<Child[]>(data.children);

  const initialAssignments: AssignmentsByMonth = useMemo(() => {
    const byMonth: AssignmentsByMonth = {};
    data.assignments.forEach((a) => {
      const days = parseScheduleDays(a.schedule);
      const normalizedMonth = monthKeyFor(parseMonthKey(a.month));
      const entry: Assignment = {
        childId: a.childId,
        classroomId: a.classroomId,
        days,
        month: normalizedMonth,
      };
      if (!byMonth[normalizedMonth]) byMonth[normalizedMonth] = [];
      byMonth[normalizedMonth].push(entry);
    });
    return byMonth;
  }, [data.assignments]);

  const [assignmentsByMonth, setAssignmentsByMonth] =
    useState<AssignmentsByMonth>(initialAssignments);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newAge, setNewAge] = useState<string>('');
  const [newDays, setNewDays] = useState<DayKey[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUserSelectedClassroom, setHasUserSelectedClassroom] =
    useState(false);

  const resetLocalChanges = () => {
    setClassrooms(data.classrooms);
    setChildren(data.children);
    setAssignmentsByMonth(initialAssignments);
    setNewFirst('');
    setNewLast('');
    setNewAge('');
    setNewDays([]);
    setShowAddForm(false);
    setHasUnsavedChanges(false);
  };

  const confirmDiscardChanges = () =>
    window.confirm(
      'You have unsaved changes.\nAre you sure you want to leave without saving?'
    );

  const handleMonthChange = (value: string) => {
    if (!hasUnsavedChanges) {
      setSelectedMonth(value);
      return;
    }
    if (confirmDiscardChanges()) {
      resetLocalChanges();
      setSelectedMonth(value);
    }
  };

  const handleClassroomChange = (value: string) => {
    if (!hasUnsavedChanges) {
      setHasUserSelectedClassroom(true);
      setSelectedClassroomId(value);
      return;
    }
    if (confirmDiscardChanges()) {
      resetLocalChanges();
      setHasUserSelectedClassroom(true);
      setSelectedClassroomId(value);
    }
  };

  const currentMonthAssignments = useMemo(
    () => assignmentsByMonth[resolvedSelectedMonth] ?? [],
    [assignmentsByMonth, resolvedSelectedMonth]
  );
  const resolvedSelectedClassroomId = useMemo(() => {
    const baseSelectedClassroomId =
      selectedClassroomId || data.classrooms[0]?.id || '';
    if (hasUnsavedChanges || hasUserSelectedClassroom) {
      return baseSelectedClassroomId;
    }

    const firstConfiguredId = data.classrooms[0]?.id ?? '';
    const firstAssigned =
      currentMonthAssignments.find((a) => a.classroomId)?.classroomId ?? '';
    const firstConfiguredHasAssignments = firstConfiguredId
      ? currentMonthAssignments.some((a) => a.classroomId === firstConfiguredId)
      : false;

    if (firstConfiguredId) {
      if (firstConfiguredHasAssignments) return firstConfiguredId;
      if (firstAssigned) return firstAssigned;
      if (!baseSelectedClassroomId) return firstConfiguredId;
      return baseSelectedClassroomId;
    }

    if (firstAssigned) return firstAssigned;
    return baseSelectedClassroomId;
  }, [
    currentMonthAssignments,
    selectedClassroomId,
    hasUnsavedChanges,
    hasUserSelectedClassroom,
    data.classrooms,
  ]);

  const classroomAssignments = useMemo(
    () =>
      currentMonthAssignments.filter(
        (a) => a.classroomId === resolvedSelectedClassroomId
      ),
    [currentMonthAssignments, resolvedSelectedClassroomId]
  );

  const enrolledCount = classroomAssignments.length;
  const selectedClassroom = classrooms.find(
    (c) => c.id === resolvedSelectedClassroomId
  );
  const capacity = selectedClassroom?.capacity ?? null;
  const ageRange = selectedClassroom?.ageRange ?? null;

  const dayCountsByClassroom = useMemo(() => {
    const counts: Record<string, Record<DayKey, number>> = {};
    currentMonthAssignments.forEach((a) => {
      const classroomId = a.classroomId;
      if (!classroomId) return;
      if (!counts[classroomId]) {
        counts[classroomId] = { M: 0, T: 0, W: 0, Th: 0, F: 0 };
      }
      a.days.forEach((d) => {
        counts[classroomId][d] += 1;
      });
    });
    return counts;
  }, [currentMonthAssignments]);

  const dayCounts = useMemo(
    () =>
      dayCountsByClassroom[resolvedSelectedClassroomId] ?? {
        M: 0,
        T: 0,
        W: 0,
        Th: 0,
        F: 0,
      },
    [dayCountsByClassroom, resolvedSelectedClassroomId]
  );

  const capacityByClassroom = useMemo(() => {
    const map = new Map<string, number>();
    classrooms.forEach((c) => {
      if (typeof c.capacity === 'number') {
        map.set(c.id, c.capacity);
      }
    });
    return map;
  }, [classrooms]);

  const dayAtCapacity = useMemo(() => {
    const status: Record<DayKey, boolean> = {
      M: false,
      T: false,
      W: false,
      Th: false,
      F: false,
    };
    if (typeof capacity === 'number') {
      DAY_KEYS.forEach((d) => {
        status[d] = dayCounts[d] >= capacity;
      });
    }
    return status;
  }, [capacity, dayCounts]);

  const childById = useMemo(() => {
    const map = new Map<string, Child>();
    children.forEach((c) => map.set(c.id, c));
    return map;
  }, [children]);

  const rows = classroomAssignments
    .map((a) => {
      const child = childById.get(a.childId);
      if (!child) return null;
      const ageMonths = ageInMonthsOn(child.dob, resolvedSelectedMonth);
      return { assignment: a, child, ageMonths };
    })
    .filter(
      (r): r is { assignment: Assignment; child: Child; ageMonths: number } =>
        Boolean(r)
    );

  const setDay = (childId: string, day: DayKey, enabled: boolean) => {
    setHasUnsavedChanges(true);
    setAssignmentsByMonth((prev) => {
      const monthAssignments = prev[resolvedSelectedMonth] ?? [];
      const next = monthAssignments.map((a) => {
        if (a.childId !== childId) return a;
        const has = a.days.includes(day);
        if (enabled && !has) {
          return { ...a, days: [...a.days, day] };
        }
        if (!enabled && has) {
          return { ...a, days: a.days.filter((d) => d !== day) };
        }
        return a;
      });
      return { ...prev, [resolvedSelectedMonth]: next };
    });
  };

  const updateClassroom = (childId: string, classroomId: string) => {
    const nextClassroomId = classroomId || null;
    const monthAssignments = assignmentsByMonth[resolvedSelectedMonth] ?? [];
    const current = monthAssignments.find((a) => a.childId === childId);
    if (!current) return;
    if (nextClassroomId && nextClassroomId !== current.classroomId) {
      const cap = capacityByClassroom.get(nextClassroomId);
      if (typeof cap === 'number' && current.days.length > 0) {
        const counts = dayCountsByClassroom[nextClassroomId] ?? {
          M: 0,
          T: 0,
          W: 0,
          Th: 0,
          F: 0,
        };
        const violatingDays = current.days.filter((d) => counts[d] + 1 > cap);
        if (violatingDays.length > 0) {
          const className =
            classrooms.find((c) => c.id === nextClassroomId)?.name ??
            'Selected classroom';
          const confirmMove = window.confirm(
            `${className} is at capacity on ${violatingDays.join(
              ', '
            )}. Move this child anyway?`
          );
          if (!confirmMove) return;
        }
      }
    }
    setHasUnsavedChanges(true);
    setAssignmentsByMonth((prev) => {
      const monthAssignments = prev[resolvedSelectedMonth] ?? [];
      const next = monthAssignments.map((a) =>
        a.childId === childId ? { ...a, classroomId: nextClassroomId } : a
      );
      return { ...prev, [resolvedSelectedMonth]: next };
    });
  };

  const onSave = () => {
    const newChildren = children.filter((c) => c.isNew);
    const assignments = (assignmentsByMonth[resolvedSelectedMonth] ?? []).map(
      (a) => ({
        childId: a.childId,
        classroomId: a.classroomId,
        days: a.days,
      })
    );

    const newChildrenPayload = newChildren.map((c) => {
      const assignment = (assignmentsByMonth[resolvedSelectedMonth] ?? []).find(
        (a) => a.childId === c.id
      );
      return {
        tempId: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        dob: c.dob,
        classroomId: assignment?.classroomId ?? null,
        days: assignment?.days ?? [],
      };
    });

    fetch('/dashboard/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: resolvedSelectedMonth,
        assignments,
        newChildren: newChildrenPayload,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? 'Failed to save');
        }
        return res.json() as Promise<{
          success: true;
          childIdMap: Record<string, string>;
        }>;
      })
      .then((data) => {
        const idMap = data.childIdMap ?? {};
        if (Object.keys(idMap).length === 0) {
          return;
        }
        // Replace temp ids with real ids
        setChildren((prev) =>
          prev.map((c) =>
            c.id in idMap
              ? {
                  ...c,
                  id: idMap[c.id],
                  isNew: false,
                }
              : c
          )
        );
        setAssignmentsByMonth((prev) => {
          const updated: AssignmentsByMonth = {};
          Object.entries(prev).forEach(([monthKey, list]) => {
            updated[monthKey] = list.map((a) =>
              a.childId in idMap ? { ...a, childId: idMap[a.childId] } : a
            );
          });
          return updated;
        });
      })
      .then(() => {
        setHasUnsavedChanges(false);
        router.refresh();
      })
      .catch((error) => {
        alert(
          'Failed to save changes: ' +
            (error instanceof Error ? error.message : 'Unknown error')
        );
      });
  };

  const toggleNewDay = (day: DayKey) => {
    setNewDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const missingFirst = newFirst.trim().length === 0;
  const missingLast = newLast.trim().length === 0;
  const ageNum = Number(newAge);
  const invalidAge =
    newAge.trim().length === 0 ||
    !(Number.isFinite(ageNum) && Number.isInteger(ageNum) && ageNum >= 0);
  const noDays = newDays.length === 0;
  const capacityViolations = useMemo(() => {
    if (typeof capacity !== 'number') return [];
    return newDays.filter((d) => dayAtCapacity[d]);
  }, [capacity, newDays, dayAtCapacity]);

  const canAddNewChild = useMemo(() => {
    const validName = !missingFirst && !missingLast;
    const validAge = !invalidAge;
    const hasDays = !noDays;
    return validAge && validName && hasDays;
  }, [missingFirst, missingLast, invalidAge, noDays]);

  const onAddChild = () => {
    if (!canAddNewChild) return;
    if (capacityViolations.length > 0) {
      const confirmAdd = window.confirm(
        `The following days are already at capacity: ${capacityViolations.join(
          ', '
        )}. Add this child anyway?`
      );
      if (!confirmAdd) return;
    }
    const ageNumParsed = Number(newAge);
    const id = `temp-${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const dob = (() => {
      const today = new Date();
      const yearsAgo = Math.floor(ageNumParsed / 12);
      const monthsAgo = ageNumParsed % 12;
      return new Date(
        today.getFullYear() - yearsAgo,
        today.getMonth() - monthsAgo,
        today.getDate()
      ).toISOString();
    })();
    const child: Child = {
      id,
      firstName: newFirst.trim(),
      lastName: newLast.trim(),
      dob,
      isNew: true,
    };
    setChildren((prev) => [...prev, child]);
    setHasUnsavedChanges(true);
    setAssignmentsByMonth((prev) => {
      const monthAssignments = prev[resolvedSelectedMonth] ?? [];
      const next: Assignment[] = [
        ...monthAssignments,
        {
          childId: id,
          classroomId: resolvedSelectedClassroomId || null,
          days: [...newDays],
          month: resolvedSelectedMonth,
        },
      ];
      return { ...prev, [resolvedSelectedMonth]: next };
    });
    setNewFirst('');
    setNewLast('');
    setNewAge('');
    setNewDays([]);
    setShowAddForm(false);
  };

  const removeChild = (childId: string) => {
    setHasUnsavedChanges(true);
    setAssignmentsByMonth((prev) => {
      const monthAssignments = prev[resolvedSelectedMonth] ?? [];
      const next = monthAssignments.map((a) =>
        a.childId === childId ? { ...a, classroomId: null } : a
      );
      return { ...prev, [resolvedSelectedMonth]: next };
    });
  };

  return (
    <section className="px-4">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Classroom Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              View and edit monthly classroom assignments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">Month</span>
              <select
                value={resolvedSelectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {monthOptions.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">Classroom</span>
              <select
                value={resolvedSelectedClassroomId}
                onChange={(e) => handleClassroomChange(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Daily capacity
              </p>
              <p className="text-xs text-slate-600">
                Each day is checked against capacity; total headcount may exceed
                capacity if days differ.
              </p>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold">Age range:</span>{' '}
              {ageRange ?? '—'}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DAY_KEYS.map((d) => {
              const count = dayCounts[d];
              const cap = capacity;
              const isFull = typeof cap === 'number' ? count >= cap : false;
              const label =
                d === 'M'
                  ? 'Mon'
                  : d === 'T'
                  ? 'Tue'
                  : d === 'W'
                  ? 'Wed'
                  : d === 'Th'
                  ? 'Thu'
                  : 'Fri';
              return (
                <div
                  key={d}
                  className={`rounded-lg border px-3 py-2 text-sm shadow-sm ${
                    isFull
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {label}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        isFull ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {typeof cap === 'number' ? `${count}/${cap}` : count}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {typeof cap === 'number'
                      ? isFull
                        ? 'At capacity'
                        : `${cap - count} open`
                      : 'No capacity set'}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Total enrolled: {enrolledCount}
          </p>
        </div>

        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <button
            type="button"
            onClick={() => {
              if (!showAddForm) {
                setNewFirst('');
                setNewLast('');
                setNewAge('');
                setNewDays([]);
              }
              setShowAddForm((v) => !v);
            }}
            className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {showAddForm ? 'Close' : 'Add Child'}
          </button>
        </div>

        {showAddForm ? (
          <div className="mb-4 grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:grid-cols-[1fr,1fr,140px,auto]">
            <label className="flex flex-col text-sm text-slate-700">
              <span className="font-medium">
                First Name <span className="text-rose-600">*</span>
              </span>
              <input
                type="text"
                value={newFirst}
                onChange={(e) => setNewFirst(e.target.value)}
                placeholder="e.g., Maya"
                required
                aria-invalid={missingFirst}
                className={
                  `mt-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ` +
                  (missingFirst
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100')
                }
              />
            </label>
            <label className="flex flex-col text-sm text-slate-700">
              <span className="font-medium">
                Last Name <span className="text-rose-600">*</span>
              </span>
              <input
                type="text"
                value={newLast}
                onChange={(e) => setNewLast(e.target.value)}
                placeholder="e.g., Lopez"
                required
                aria-invalid={missingLast}
                className={
                  `mt-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ` +
                  (missingLast
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100')
                }
              />
            </label>
            <label className="flex flex-col text-sm text-slate-700">
              <span className="font-medium">
                Age (months) <span className="text-rose-600">*</span>
              </span>
              <input
                type="number"
                min={0}
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
                placeholder="e.g., 30"
                required
                aria-invalid={invalidAge}
                className={
                  `mt-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ` +
                  (invalidAge
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100')
                }
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {DAY_KEYS.map((d) => {
                const checked = newDays.includes(d);
                const isFull = dayAtCapacity[d];
                return (
                  <label
                    key={d}
                    title={isFull ? 'At capacity' : 'Available'}
                    className={
                      `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ` +
                      (checked
                        ? isFull
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : isFull
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNewDay(d)}
                      className="sr-only"
                    />
                    {d}
                  </label>
                );
              })}
              {noDays ? (
                <span className="text-xs font-medium text-rose-600">
                  Select at least one day
                </span>
              ) : null}
              {capacityViolations.length > 0 ? (
                <span className="text-xs font-medium text-amber-700">
                  Selected days at capacity: {capacityViolations.join(', ')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={onAddChild}
                disabled={!canAddNewChild}
                className="ml-2 inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                Add to Classroom
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewFirst('');
                  setNewLast('');
                  setNewAge('');
                  setNewDays([]);
                }}
                className="inline-flex items-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                  First Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                  Last Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                  Age (months)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                  Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                  Classroom
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-sm text-slate-500 sm:px-6"
                    colSpan={6}
                  >
                    No children assigned to this classroom for{' '}
                    {formatMonthLabel(resolvedSelectedMonth)}.
                  </td>
                </tr>
              ) : (
                rows.map(({ assignment, child, ageMonths }) => (
                  <tr key={child.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm text-slate-900 sm:px-6">
                      {child.firstName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 sm:px-6">
                      {child.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 sm:px-6">
                      {ageMonths}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {DAY_KEYS.map((d) => {
                          const checked = assignment.days.includes(d);
                          return (
                            <label
                              key={d}
                              className={
                                `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ` +
                                (checked
                                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setDay(child.id, d, e.target.checked)
                                }
                                className="sr-only"
                              />
                              {d}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <select
                        value={assignment.classroomId ?? ''}
                        onChange={(e) =>
                          updateClassroom(child.id, e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        {classrooms.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="">Unassigned</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm sm:px-6">
                      <button
                        type="button"
                        onClick={() => removeChild(child.id)}
                        className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </section>
  );
}
