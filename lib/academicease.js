export const STORAGE_KEY = "academicease-state-v1";
export const PASS_MARK = 50;
export const SUBJECT_TEMPLATE = ["Mathematics", "English", "Biology", "Chemistry", "History"];

export const gradeBands = [
  { min: 80, grade: "A", remark: "Outstanding" },
  { min: 70, grade: "B", remark: "Very Good" },
  { min: 60, grade: "C", remark: "Good" },
  { min: 50, grade: "D", remark: "Fair" },
  { min: 40, grade: "E", remark: "Needs Support" },
  { min: 0, grade: "F", remark: "Needs Improvement" },
];

export function getGradeBand(score) {
  return gradeBands.find((band) => score >= band.min) || gradeBands[gradeBands.length - 1];
}

export function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(number)));
}

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `student-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDraftSubjects() {
  return SUBJECT_TEMPLATE.map((name) => ({ name, score: "" }));
}

export function createStudent(name, admissionNumber, gender, scores) {
  return {
    id: createId(),
    name,
    admissionNumber,
    gender,
    subjects: SUBJECT_TEMPLATE.map((subject, index) => ({
      name: subject,
      score: clampScore(scores[index]),
    })),
  };
}

export function createInitialState() {
  const students = [
    createStudent("Amina Hassan", "ACE-001", "Female", [88, 79, 91, 85, 82]),
    createStudent("Daniel Mwakyusa", "ACE-002", "Male", [74, 68, 72, 77, 70]),
    createStudent("Neema Joseph", "ACE-003", "Female", [93, 89, 95, 90, 92]),
    createStudent("Brian Mollel", "ACE-004", "Male", [61, 58, 64, 60, 66]),
  ];

  return {
    settings: {
      schoolName: "AcademicEase Demonstration School",
      className: "Form 3",
      term: "Term 1",
      year: "2026",
    },
    students,
    selectedStudentId: students[0]?.id || null,
  };
}

export function getStudentMetrics(student) {
  const subjects = student.subjects
    .filter((subject) => subject.name && subject.name.trim())
    .map((subject) => ({
      name: subject.name.trim(),
      score: clampScore(subject.score),
    }));

  const total = subjects.reduce((sum, subject) => sum + subject.score, 0);
  const average = subjects.length ? total / subjects.length : 0;
  const band = getGradeBand(average);
  const highest = subjects.length ? Math.max(...subjects.map((subject) => subject.score)) : 0;
  const passedSubjects = subjects.filter((subject) => subject.score >= PASS_MARK).length;

  return {
    ...student,
    subjects,
    total,
    average,
    grade: band.grade,
    remark: band.remark,
    highest,
    passedSubjects,
    failedSubjects: Math.max(subjects.length - passedSubjects, 0),
  };
}

export function getRankedStudents(students) {
  return students
    .map(getStudentMetrics)
    .sort((left, right) => {
      if (right.average !== left.average) {
        return right.average - left.average;
      }
      if (right.total !== left.total) {
        return right.total - left.total;
      }
      return left.name.localeCompare(right.name);
    })
    .map((student, index) => ({
      ...student,
      position: index + 1,
    }));
}

export function getSummary(students) {
  const totalStudents = students.length;
  const totalSubjects = students.reduce((sum, student) => sum + student.subjects.length, 0);
  const totalAverage = students.reduce((sum, student) => sum + student.average, 0);
  const passingStudents = students.filter((student) => student.average >= PASS_MARK).length;
  const classAverage = totalStudents ? totalAverage / totalStudents : 0;
  const passRate = totalStudents ? (passingStudents / totalStudents) * 100 : 0;

  const gradeDistribution = ["A", "B", "C", "D", "E", "F"].map((grade) => {
    const count = students.filter((student) => student.grade === grade).length;
    return {
      grade,
      label: count ? `${count} student${count === 1 ? "" : "s"} in Grade ${grade}` : `No Grade ${grade} yet`,
      count,
      percentage: totalStudents ? (count / totalStudents) * 100 : 0,
    };
  });

  return {
    classAverage,
    gradeDistribution,
    passRate,
    passingStudents,
    topStudent: students[0] || null,
    totalStudents,
    totalSubjects,
  };
}

export function getSubjectInsights(students) {
  const subjectsMap = new Map();

  students.forEach((student) => {
    student.subjects.forEach((subject) => {
      const current = subjectsMap.get(subject.name) || {
        name: subject.name,
        total: 0,
        count: 0,
        passed: 0,
        highest: 0,
      };

      current.total += subject.score;
      current.count += 1;
      current.passed += subject.score >= PASS_MARK ? 1 : 0;
      current.highest = Math.max(current.highest, subject.score);
      subjectsMap.set(subject.name, current);
    });
  });

  return [...subjectsMap.values()]
    .map((subject) => ({
      ...subject,
      average: subject.count ? subject.total / subject.count : 0,
      passRate: subject.count ? (subject.passed / subject.count) * 100 : 0,
    }))
    .sort((left, right) => right.average - left.average);
}

export function normalizeState(raw) {
  const fallback = createInitialState();
  const settings = {
    schoolName: raw?.settings?.schoolName || fallback.settings.schoolName,
    className: raw?.settings?.className || fallback.settings.className,
    term: raw?.settings?.term || fallback.settings.term,
    year: raw?.settings?.year || fallback.settings.year,
  };

  const students = Array.isArray(raw?.students)
    ? raw.students
        .map((student) => {
          if (!student?.name || !student?.admissionNumber) {
            return null;
          }

          const subjects = Array.isArray(student.subjects)
            ? student.subjects
                .map((subject) => ({
                  name: String(subject?.name || "").trim(),
                  score: clampScore(subject?.score),
                }))
                .filter((subject) => subject.name)
            : [];

          return {
            id: student.id || createId(),
            name: String(student.name).trim(),
            admissionNumber: String(student.admissionNumber).trim(),
            gender: String(student.gender || "Prefer not to say"),
            subjects,
          };
        })
        .filter(Boolean)
    : fallback.students;

  return {
    settings,
    students,
    selectedStudentId:
      raw?.selectedStudentId && students.some((student) => student.id === raw.selectedStudentId)
        ? raw.selectedStudentId
        : students[0]?.id || null,
  };
}
