export type ClassroomFormValues = {
  name: string;
  ageRange: string;
  capacity: string;
  id?: string;
};

export type ClassroomRecord = {
  id: string;
  name: string;
  age_range: string | null;
  capacity: number | null;
};

export type ClassroomSubmission = {
  name: string;
  age_range: string;
  capacity: number;
};

export type ClassroomRequestPayload = {
  classrooms: ClassroomSubmission[];
};
