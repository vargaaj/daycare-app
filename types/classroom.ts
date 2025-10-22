export type ClassroomFormValues = {
  name: string;
  ageRange: string;
  capacity: string;
};

export type ClassroomSubmission = {
  name: string;
  age_range: string;
  capacity: number;
};

export type ClassroomRequestPayload = {
  classrooms: ClassroomSubmission[];
};

