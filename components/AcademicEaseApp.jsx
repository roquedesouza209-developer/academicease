"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  PASS_MARK,
  STORAGE_KEY,
  clampScore,
  createDraftSubjects,
  createId,
  createInitialState,
  getGradeBand,
  getRankedStudents,
  getStudentMetrics,
  getSubjectInsights,
  getSummary,
  normalizeState,
} from "../lib/academicease";

const EMPTY_STUDENT_FORM = {
  name: "",
  admissionNumber: "",
  gender: "Female",
};

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadStoredState() {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : createInitialState();
  } catch (error) {
    return createInitialState();
  }
}

function formatDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
  }).format(date);
}

export default function AcademicEaseApp() {
  const [state, setState] = useState(createInitialState);
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT_FORM);
  const [draftSubjects, setDraftSubjects] = useState(createDraftSubjects);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  const fileInputRef = useRef(null);
  const formHeadingRef = useRef(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    setState(loadStoredState());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isHydrated, state]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleAfterPrint = () => {
      document.body.classList.remove("print-report-mode");
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const rankedStudents = getRankedStudents(state.students);
  const selectedStudent =
    rankedStudents.find((student) => student.id === state.selectedStudentId) || null;
  const summary = getSummary(rankedStudents);
  const subjectInsights = getSubjectInsights(rankedStudents);
  const draftMetrics = getStudentMetrics({
    id: "draft",
    name: "Draft",
    admissionNumber: "",
    gender: "",
    subjects: draftSubjects.filter((subject) => subject.name.trim()),
  });
  const filteredStudents = rankedStudents.filter((student) => {
    if (!deferredSearchTerm.trim()) {
      return true;
    }

    const normalizedTerm = deferredSearchTerm.trim().toLowerCase();
    return (
      student.name.toLowerCase().includes(normalizedTerm) ||
      student.admissionNumber.toLowerCase().includes(normalizedTerm)
    );
  });

  useEffect(() => {
    if (!rankedStudents.length) {
      if (state.selectedStudentId !== null) {
        setState((current) => ({
          ...current,
          selectedStudentId: null,
        }));
      }
      return;
    }

    if (!selectedStudent) {
      setState((current) => ({
        ...current,
        selectedStudentId: rankedStudents[0].id,
      }));
    }
  }, [rankedStudents, selectedStudent, state.selectedStudentId]);

  function resetStudentForm(student = null) {
    setEditingStudentId(student?.id || null);
    setStudentForm(
      student
        ? {
            name: student.name,
            admissionNumber: student.admissionNumber,
            gender: student.gender,
          }
        : EMPTY_STUDENT_FORM,
    );
    setDraftSubjects(
      student
        ? student.subjects.map((subject) => ({
            name: subject.name,
            score: String(subject.score),
          }))
        : createDraftSubjects(),
    );
  }

  function handleSettingsChange(field, value) {
    const fallbacks = {
      schoolName: "AcademicEase Demonstration School",
      className: "Form 3",
      term: "Term 1",
      year: new Date().getFullYear().toString(),
    };

    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [field]: value.trim() || fallbacks[field],
      },
    }));
  }

  function handleDraftSubjectChange(index, field, value) {
    setDraftSubjects((current) =>
      current.map((subject, currentIndex) =>
        currentIndex === index ? { ...subject, [field]: value } : subject,
      ),
    );
  }

  function addDraftSubject() {
    setDraftSubjects((current) => [...current, { name: "", score: "" }]);
  }

  function removeDraftSubject(index) {
    setDraftSubjects((current) => {
      const nextSubjects = current.filter((_, currentIndex) => currentIndex !== index);
      return nextSubjects.length ? nextSubjects : [{ name: "", score: "" }];
    });
  }

  function handleStudentSubmit(event) {
    event.preventDefault();

    const subjects = draftSubjects
      .map((subject) => ({
        name: subject.name.trim(),
        score: clampScore(subject.score),
      }))
      .filter((subject) => subject.name);

    if (!studentForm.name.trim() || !studentForm.admissionNumber.trim() || !subjects.length) {
      window.alert("Please enter the student name, admission number, and at least one subject.");
      return;
    }

    const nextStudent = {
      id: editingStudentId || createId(),
      name: studentForm.name.trim(),
      admissionNumber: studentForm.admissionNumber.trim(),
      gender: studentForm.gender,
      subjects,
    };

    setState((current) => ({
      ...current,
      students: editingStudentId
        ? current.students.map((student) =>
            student.id === editingStudentId ? nextStudent : student,
          )
        : [...current.students, nextStudent],
      selectedStudentId: nextStudent.id,
    }));

    resetStudentForm();
  }

  function handlePreview(id) {
    setState((current) => ({
      ...current,
      selectedStudentId: id,
    }));
  }

  function handleEdit(student) {
    resetStudentForm(student);
    window.requestAnimationFrame(() => {
      formHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleDelete(student) {
    if (!window.confirm(`Delete ${student.name}'s result record?`)) {
      return;
    }

    setState((current) => {
      const nextStudents = current.students.filter((item) => item.id !== student.id);
      return {
        ...current,
        students: nextStudents,
        selectedStudentId:
          current.selectedStudentId === student.id ? nextStudents[0]?.id || null : current.selectedStudentId,
      };
    });

    if (editingStudentId === student.id) {
      resetStudentForm();
    }
  }

  function handleReportSelection(id) {
    setState((current) => ({
      ...current,
      selectedStudentId: id || null,
    }));
  }

  function handleLoadDemoData() {
    setState(createInitialState());
    setSearchTerm("");
    resetStudentForm();
  }

  function handleClearRecords() {
    if (!window.confirm("Clear every saved student record from this device?")) {
      return;
    }

    setState((current) => ({
      ...current,
      students: [],
      selectedStudentId: null,
    }));
    resetStudentForm();
  }

  function handleExportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      state,
    };

    downloadFile(
      `academicease-backup-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
      JSON.stringify(payload, null, 2),
    );
  }

  function handleImportData(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        setState(normalizeState(parsed.state || parsed));
        setSearchTerm("");
        resetStudentForm();
      } catch (error) {
        window.alert("That file could not be imported. Please choose a valid AcademicEase JSON backup.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function handleExportCsv() {
    if (!rankedStudents.length) {
      window.alert("There are no student records to export.");
      return;
    }

    const rows = [
      [
        "Position",
        "Student Name",
        "Admission Number",
        "Gender",
        "Subjects",
        "Total",
        "Average",
        "Grade",
        "Remark",
      ],
      ...rankedStudents.map((student) => [
        student.position,
        student.name,
        student.admissionNumber,
        student.gender,
        student.subjects.map((subject) => `${subject.name} (${subject.score})`).join("; "),
        student.total,
        student.average.toFixed(1),
        student.grade,
        student.remark,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    downloadFile(`academicease-results-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv", csv);
  }

  function handlePrintReport() {
    if (!selectedStudent) {
      window.alert("Select a student report first.");
      return;
    }

    document.body.classList.add("print-report-mode");
    window.print();
  }

  const summaryCards = [
    {
      label: "Students Recorded",
      value: summary.totalStudents,
      detail: "Active records currently saved on this device.",
      pill: `${summary.totalSubjects} subject scores logged`,
    },
    {
      label: "Class Average",
      value: `${summary.classAverage.toFixed(1)}%`,
      detail: "Average performance across all saved students.",
      pill: summary.gradeDistribution[0]?.label || "No grades yet",
    },
    {
      label: "Pass Rate",
      value: `${summary.passRate.toFixed(0)}%`,
      detail: `Students meeting the ${PASS_MARK}% pass threshold.`,
      pill: `${summary.passingStudents} students passing`,
    },
    {
      label: "Top Performer",
      value: summary.topStudent ? summary.topStudent.name : "No data",
      detail: summary.topStudent
        ? `${summary.topStudent.average.toFixed(1)}% average, Grade ${summary.topStudent.grade}`
        : "Add results to reveal the leading student.",
      pill: summary.topStudent ? `Position ${summary.topStudent.position}` : "Awaiting marks entry",
    },
  ];

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Academic Results Management</span>
          <h1>AcademicEase</h1>
          <p className="hero-text">
            Replace manual spreadsheets with a clean digital workspace for marks entry,
            automatic grading, student performance analysis, and polished report cards.
          </p>
        </div>

        <div className="hero-panel">
          <p className="hero-panel-label">Next.js Foundation</p>
          <ul className="hero-points">
            <li>Easy marks entry</li>
            <li>Automatic calculations</li>
            <li>Performance analysis</li>
            <li>Printable report generation</li>
            <li>Ready for database and auth next</li>
          </ul>
        </div>
      </header>

      <section className="panel toolbar">
        <div className="toolbar-actions">
          <button className="button accent" type="button" onClick={handleExportData}>
            Export Data
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Import Data
          </button>
          <button className="button secondary" type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button className="button secondary" type="button" onClick={handlePrintReport}>
            Print / Save PDF
          </button>
          <button className="button ghost" type="button" onClick={handleLoadDemoData}>
            Load Demo Data
          </button>
          <button className="button ghost danger" type="button" onClick={handleClearRecords}>
            Clear Records
          </button>
          <input
            ref={fileInputRef}
            hidden
            accept="application/json"
            type="file"
            onChange={handleImportData}
          />
        </div>
        <p className="toolbar-note">
          {isHydrated
            ? "Results are saved automatically on this device through your browser's local storage."
            : "Loading saved records from this device."}
        </p>
      </section>

      <section className="summary-grid" aria-label="Summary cards">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Setup</span>
              <h2>School Details</h2>
            </div>
            <p>These details appear across report cards and the result summary.</p>
          </div>

          <div className="settings-grid">
            <label>
              <span>School Name</span>
              <input
                type="text"
                value={state.settings.schoolName}
                onChange={(event) => handleSettingsChange("schoolName", event.target.value)}
              />
            </label>
            <label>
              <span>Class Name</span>
              <input
                type="text"
                value={state.settings.className}
                onChange={(event) => handleSettingsChange("className", event.target.value)}
              />
            </label>
            <label>
              <span>Term</span>
              <input
                type="text"
                value={state.settings.term}
                onChange={(event) => handleSettingsChange("term", event.target.value)}
              />
            </label>
            <label>
              <span>Academic Year</span>
              <input
                type="text"
                value={state.settings.year}
                onChange={(event) => handleSettingsChange("year", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Insights</span>
              <h2>Performance Analytics</h2>
            </div>
            <p>Live classroom trends based on the scores currently entered.</p>
          </div>

          {rankedStudents.length ? (
            <div className="analytics-grid">
              <article className="analytics-card">
                <h3>Top Performers</h3>
                <div className="top-list">
                  {rankedStudents.slice(0, 3).map((student) => (
                    <div className="top-item" key={student.id}>
                      <div className="top-item-head">
                        <strong>{student.name}</strong>
                        <span className="score-pill">{student.average.toFixed(1)}%</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${student.average}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analytics-card">
                <h3>Grade Distribution</h3>
                <div className="distribution-list">
                  {summary.gradeDistribution.map((band) => (
                    <div className="distribution-item" key={band.grade}>
                      <div className="distribution-item-head">
                        <strong>Grade {band.grade}</strong>
                        <span>
                          {band.count} student{band.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${band.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analytics-card">
                <h3>Subject Performance</h3>
                <div className="subject-list">
                  {subjectInsights.map((subject) => (
                    <div className="subject-item" key={subject.name}>
                      <div className="subject-item-head">
                        <strong>{subject.name}</strong>
                        <span>{subject.average.toFixed(1)}% avg</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${subject.average}%` }} />
                      </div>
                      <div className="subject-row-summary">
                        <span>{subject.passRate.toFixed(0)}% pass rate</span>
                        <span>Highest {subject.highest}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <EmptyState message="Performance analytics will appear once student marks are entered." />
          )}
        </section>
      </div>

      <div className="workspace-grid workspace-grid-wide">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Marks Entry</span>
              <h2 ref={formHeadingRef}>
                {editingStudentId ? "Edit Student Results" : "Add Student Results"}
              </h2>
            </div>
            <p>
              {editingStudentId
                ? "Update the selected student record and save your changes."
                : "Enter student information and subject scores."}
            </p>
          </div>

          <form className="student-form" onSubmit={handleStudentSubmit}>
            <div className="settings-grid">
              <label>
                <span>Student Name</span>
                <input
                  required
                  type="text"
                  value={studentForm.name}
                  onChange={(event) =>
                    setStudentForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Admission Number</span>
                <input
                  required
                  type="text"
                  value={studentForm.admissionNumber}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      admissionNumber: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Gender</span>
                <select
                  value={studentForm.gender}
                  onChange={(event) =>
                    setStudentForm((current) => ({ ...current, gender: event.target.value }))
                  }
                >
                  <option>Female</option>
                  <option>Male</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
            </div>

            <div className="subject-header">
              <h3>Subjects and Scores</h3>
              <button className="button secondary" type="button" onClick={addDraftSubject}>
                Add Subject
              </button>
            </div>

            <div className="subject-rows">
              {draftSubjects.map((subject, index) => {
                const band = getGradeBand(clampScore(subject.score));
                return (
                  <div className="subject-row" key={`${subject.name}-${index}`}>
                    <label>
                      <span>Subject Name</span>
                      <input
                        type="text"
                        value={subject.name}
                        placeholder="e.g. Mathematics"
                        onChange={(event) =>
                          handleDraftSubjectChange(index, "name", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Score</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={subject.score}
                        placeholder="0-100"
                        onChange={(event) =>
                          handleDraftSubjectChange(index, "score", event.target.value)
                        }
                      />
                    </label>
                    <div>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => removeDraftSubject(index)}
                      >
                        Remove
                      </button>
                      <div className="subject-row-summary">
                        <span>Grade {band.grade}</span>
                        <span>{band.remark}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="draft-summary">
              <DraftSummaryCard label="Subjects" value={draftMetrics.subjects.length} />
              <DraftSummaryCard label="Total" value={draftMetrics.total} />
              <DraftSummaryCard label="Average" value={`${draftMetrics.average.toFixed(1)}%`} />
              <DraftSummaryCard
                label="Grade"
                value={`${draftMetrics.grade} - ${draftMetrics.remark}`}
              />
            </div>

            <div className="form-actions">
              <button className="button accent" type="submit">
                {editingStudentId ? "Update Result" : "Save Result"}
              </button>
              <button className="button secondary" type="button" onClick={() => resetStudentForm()}>
                Reset Form
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Records</span>
              <h2>Student Results</h2>
            </div>
            <p>Search, edit, preview, or remove any student record.</p>
          </div>

          <div className="records-toolbar">
            <input
              className="search-input"
              type="search"
              placeholder="Search by name or admission number"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="table-shell">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Student</th>
                  <th>Admission No.</th>
                  <th>Subjects</th>
                  <th>Total</th>
                  <th>Average</th>
                  <th>Grade</th>
                  <th>Remark</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length ? (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className={student.id === state.selectedStudentId ? "selected-row" : ""}
                    >
                      <td>{student.position}</td>
                      <td>
                        <strong>{student.name}</strong>
                        <div className="table-tag">{student.gender}</div>
                      </td>
                      <td>{student.admissionNumber}</td>
                      <td>{student.subjects.length}</td>
                      <td>{student.total}</td>
                      <td>{student.average.toFixed(1)}%</td>
                      <td>
                        <span className="score-pill">Grade {student.grade}</span>
                      </td>
                      <td>{student.remark}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => handlePreview(student.id)}
                          >
                            Preview
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => handleEdit(student)}
                          >
                            Edit
                          </button>
                          <button
                            className="button ghost danger"
                            type="button"
                            onClick={() => handleDelete(student)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9">
                      <EmptyState
                        message={
                          deferredSearchTerm.trim()
                            ? "No student matched that search."
                            : "No student records yet. Add results to begin."
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section id="reportSection" className="panel report-panel">
        <div className="section-heading report-heading">
          <div>
            <span className="section-kicker">Reports</span>
            <h2>Printable Report Card</h2>
          </div>
          <div className="report-controls">
            <label>
              <span className="visually-hidden">Select student report</span>
              <select
                value={state.selectedStudentId || ""}
                onChange={(event) => handleReportSelection(event.target.value)}
              >
                {rankedStudents.length ? (
                  rankedStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.admissionNumber})
                    </option>
                  ))
                ) : (
                  <option value="">No reports available</option>
                )}
              </select>
            </label>
            <button className="button accent" type="button" onClick={handlePrintReport}>
              Print This Report
            </button>
          </div>
        </div>

        <div className="report-preview">
          {selectedStudent ? (
            <ReportCard
              schoolSettings={state.settings}
              selectedStudent={selectedStudent}
              totalStudents={rankedStudents.length}
            />
          ) : (
            <EmptyState message="Choose or create a student result to generate a report card." />
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail, pill }) {
  return (
    <article className="metric-card">
      <span className="section-kicker">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      <span className="pill">{pill}</span>
    </article>
  );
}

function DraftSummaryCard({ label, value }) {
  return (
    <div className="draft-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <div>
        <strong>Nothing to show yet</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function ReportCard({ schoolSettings, selectedStudent, totalStudents }) {
  return (
    <article className="report-card">
      <div className="report-top">
        <div>
          <span className="section-kicker">Official Result Slip</span>
          <h3>{schoolSettings.schoolName}</h3>
          <p>
            {schoolSettings.className} - {schoolSettings.term} - {schoolSettings.year}
          </p>
        </div>
        <div className="report-meta">
          <div className="report-meta-item">
            <span className="section-kicker">Generated</span>
            <p>{formatDisplayDate()}</p>
          </div>
          <div className="report-meta-item">
            <span className="section-kicker">Standing</span>
            <p>
              Position {selectedStudent.position} of {totalStudents}
            </p>
          </div>
        </div>
      </div>

      <div className="report-student-grid">
        <div className="report-student-card">
          <span>Student Name</span>
          <strong>{selectedStudent.name}</strong>
        </div>
        <div className="report-student-card">
          <span>Admission Number</span>
          <strong>{selectedStudent.admissionNumber}</strong>
        </div>
        <div className="report-student-card">
          <span>Gender</span>
          <strong>{selectedStudent.gender}</strong>
        </div>
        <div className="report-student-card">
          <span>Performance Band</span>
          <strong className="report-badge">Grade {selectedStudent.grade}</strong>
        </div>
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {selectedStudent.subjects.map((subject) => {
            const band = getGradeBand(subject.score);
            return (
              <tr key={`${selectedStudent.id}-${subject.name}`}>
                <td>{subject.name}</td>
                <td>{subject.score}%</td>
                <td>{band.grade}</td>
                <td>{band.remark}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="report-overview">
        <div className="report-overview-card">
          <span>Total Marks</span>
          <strong>{selectedStudent.total}</strong>
        </div>
        <div className="report-overview-card">
          <span>Average Score</span>
          <strong>{selectedStudent.average.toFixed(1)}%</strong>
        </div>
        <div className="report-overview-card">
          <span>Subjects Passed</span>
          <strong>{selectedStudent.passedSubjects}</strong>
        </div>
        <div className="report-overview-card">
          <span>Teacher Remark</span>
          <strong>{selectedStudent.remark}</strong>
        </div>
      </div>

      <div className="report-footer">
        <div className="report-meta-item">
          <span className="section-kicker">Summary</span>
          <p>
            {selectedStudent.name} achieved an overall average of{" "}
            {selectedStudent.average.toFixed(1)}%, earning Grade {selectedStudent.grade}. This
            report is ready to print or save as PDF from the browser.
          </p>
        </div>
        <div className="signature-blocks">
          <div className="signature">Class Teacher Signature</div>
          <div className="signature">Principal Signature</div>
        </div>
      </div>
    </article>
  );
}
