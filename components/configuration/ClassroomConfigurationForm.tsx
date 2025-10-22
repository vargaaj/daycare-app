'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ClassroomFormValues } from '@/types/classroom';

const ageRangePattern = /^\s*(\d+)\s*[-\u2013]\s*(\d+)/;

const isValidAgeRange = (value: string) => {
  const match = value.trim().match(ageRangePattern);
  if (!match) {
    return false;
  }

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);

  return Number.isInteger(start) && Number.isInteger(end) && end > start;
};

const emptyClassroom: ClassroomFormValues = {
  name: '',
  ageRange: '',
  capacity: '',
};

export function ClassroomConfigurationForm() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<ClassroomFormValues[]>([
    { ...emptyClassroom },
  ]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateClassroom =
    (index: number, field: keyof ClassroomFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setClassrooms((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
      if (submissionError) {
        setSubmissionError(null);
      }
    };

  const addClassroom = () => {
    setClassrooms((prev) => [...prev, { ...emptyClassroom }]);
  };

  const removeClassroom = (index: number) => () => {
    setClassrooms((prev) => prev.filter((_, idx) => idx !== index));
  };

  const isFormValid = useMemo(
    () =>
      classrooms.length > 0 &&
      classrooms.every((classroom) => {
        const capacityNumber = Number(classroom.capacity);
        return (
          classroom.name.trim().length > 0 &&
          isValidAgeRange(classroom.ageRange) &&
          Number.isInteger(capacityNumber) &&
          capacityNumber > 0
        );
      }),
    [classrooms]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      setSubmissionError(
        'Please complete every classroom with a valid range (e.g., 12-24 months where the second number is larger) and a positive capacity before continuing.'
      );
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/configure/api/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classrooms: classrooms.map((classroom) => ({
            name: classroom.name.trim(),
            age_range: classroom.ageRange.trim(),
            capacity: Number(classroom.capacity),
          })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'We could not save your classrooms. Please try again.'
        );
      }

      router.push('/upload');
    } catch (error) {
      console.error('Failed to save classrooms', error);
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'We could not save your classrooms. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-8 shadow-lg ring-1 ring-black/5"
    >
      <header className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Configure Your Classrooms
        </h1>
        <p className="mt-3 text-sm text-slate-600 sm:text-base">
          Describe each classroom you run so we can tailor the optimizer to your
          setup. You can add as many rooms as you need.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        {classrooms.map((classroom, index) => (
          <div
            key={`classroom-${index}`}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-6"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Classroom {index + 1}
              </h2>
              {classrooms.length > 1 ? (
                <button
                  type="button"
                  onClick={removeClassroom(index)}
                  className="text-xs font-medium text-rose-600 transition hover:text-rose-700"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Classroom Name
                <input
                  type="text"
                  value={classroom.name}
                  onChange={updateClassroom(index, 'name')}
                  placeholder="e.g., Sunshine Room"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Age Range (Months)
                <input
                  type="text"
                  value={classroom.ageRange}
                  onChange={updateClassroom(index, 'ageRange')}
                  placeholder="e.g., 12-24 months"
                  title="Enter a numeric range such as 12-24 months where the end is higher than the start"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="mt-1 text-xs font-normal text-slate-500">
                  Use numbers on both sides of a dash, and keep the second number higher: 12-24 months or 2-3 years old.
                </span>
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Capacity
                <input
                  type="number"
                  min={0}
                  value={classroom.capacity}
                  onChange={updateClassroom(index, 'capacity')}
                  placeholder="e.g., 12"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={addClassroom}
          className="inline-flex items-center rounded-full border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
        >
          + Add classroom
        </button>
        <div className="flex flex-col items-end">
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Next'}
          </button>
          <span className="mt-2 text-xs text-slate-500">
            We&apos;ll take you to the upload step next.
          </span>
        </div>
      </div>

      {submissionError ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {submissionError}
        </p>
      ) : null}
    </form>
  );
}
