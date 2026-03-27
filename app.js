const STORAGE_KEY = "academicease-state-v1";
const PASS_MARK = 50;
const SUBJECT_TEMPLATE = ["Mathematics", "English", "Biology", "Chemistry", "History"];

const gradeBands = [
  { min: 80, grade: "A", remark: "Outstanding" },
  { min: 70, grade: "B", remark: "Very Good" },
  { min: 60, grade: "C", remark: "Good" },
  { min: 50, grade: "D", remark: "Fair" },
  { min: 40, grade: "E", remark: "Needs Support" },
  { min: 0, grade: "F", remark: "Needs Improvement" },
];

const elements = {
  analyticsPanel: document.getElementById("analyticsPanel"),
  addSubjectBtn: document.getElementById("addSubjectBtn"),
  admissionNumberInput: document.getElementById("admissionNumberInput"),
  classNameInput: document.getElementById("classNameInput"),
  clearDataBtn: document.getElementById("clearDataBtn"),
  draftSummary: document.getElementById("draftSummary"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  genderInput: document.getElementById("genderInput"),
  importDataBtn: document.getElementById("importDataBtn"),
  importFileInput: document.getElementById("importFileInput"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),
  printCurrentReportBtn: document.getElementById("printCurrentReportBtn"),
  printReportBtn: document.getElementById("printReportBtn"),
  recordsTableBody: document.getElementById("recordsTableBody"),
  reportPreview: document.getElementById("reportPreview"),
  reportStudentSelect: document.getElementById("reportStudentSelect"),
  resetFormBtn: document.getElementById("resetFormBtn"),
  saveStudentBtn: document.getElementById("saveStudentBtn"),
  schoolNameInput: document.getElementById("schoolNameInput"),
  searchInput: document.getElementById("searchInput"),
  settingsForm: document.getElementById("settingsForm"),
  studentForm: document.getElementById("studentForm"),
  studentFormSubtitle: document.getElementById("studentFormSubtitle"),
  studentFormTitle: document.getElementById("studentFormTitle"),
  studentNameInput: document.getElementById("studentNameInput"),
  subjectRows: document.getElementById("subjectRows"),
  summaryCards: document.getElementById("summaryCards"),
  termInput: document.getElementById("termInput"),
  yearInput: document.getElementById("yearInput"),
};

let state = loadState();
let editingStudentId = null;
let draftSubjects = createDraftSubjects();

initialize();

function initialize() {
  applySettingsToInputs();
  attachEventListeners();
  renderAll();
  resetStudentForm();
}

function attachEventListeners() {
  elements.settingsForm.addEventListener("input", handleSettingsInput);
  elements.studentForm.addEventListener("submit", handleStudentSubmit);
  elements.resetFormBtn.addEventListener("click", () => resetStudentForm());
  elements.addSubjectBtn.addEventListener("click", addDraftSubject);
  elements.subjectRows.addEventListener("input", handleSubjectRowInput);
  elements.subjectRows.addEventListener("click", handleSubjectRowClick);
  elements.searchInput.addEventListener("input", renderRecordsTable);
  elements.recordsTableBody.addEventListener("click", handleTableAction);
  elements.reportStudentSelect.addEventListener("change", handleReportSelection);
  elements.exportDataBtn.addEventListener("click", exportData);
  elements.importDataBtn.addEventListener("click", () => elements.importFileInput.click());
  elements.importFileInput.addEventListener("change", importData);
  elements.exportCsvBtn.addEventListener("click", exportCsv);
  elements.printReportBtn.addEventListener("click", printCurrentReport);
  elements.printCurrentReportBtn.addEventListener("click", printCurrentReport);
  elements.clearDataBtn.addEventListener("click", clearRecords);
  elements.loadDemoBtn.addEventListener("click", loadDemoData);
  window.addEventListener("afterprint", () => document.body.classList.remove("print-report-mode"));
}

function handleSettingsInput() {
  state.settings = {
    schoolName: elements.schoolNameInput.value.trim() || "AcademicEase Demonstration School",
    className: elements.classNameInput.value.trim() || "Form 3",
    term: elements.termInput.value.trim() || "Term 1",
    year: elements.yearInput.value.trim() || new Date().getFullYear().toString(),
  };
  persistState();
  renderAll();
}

function handleStudentSubmit(event) {
  event.preventDefault();

  const name = elements.studentNameInput.value.trim();
  const admissionNumber = elements.admissionNumberInput.value.trim();
  const gender = elements.genderInput.value;
  const subjects = draftSubjects
    .map((subject) => ({
      name: subject.name.trim(),
      score: clampScore(subject.score),
    }))
    .filter((subject) => subject.name);

  if (!name || !admissionNumber || !subjects.length) {
    window.alert("Please enter the student name, admission number, and at least one subject.");
    return;
  }

  const nextStudent = {
    id: editingStudentId || createId(),
    name,
    admissionNumber,
    gender,
    subjects,
  };

  if (editingStudentId) {
    state.students = state.students.map((student) =>
      student.id === editingStudentId ? nextStudent : student,
    );
  } else {
    state.students = [...state.students, nextStudent];
  }

  state.selectedStudentId = nextStudent.id;
  persistState();
  renderAll();
  resetStudentForm();
}

function handleSubjectRowInput(event) {
  const row = event.target.closest("[data-index]");
  if (!row) {
    return;
  }

  const index = Number(row.dataset.index);
  const field = event.target.dataset.field;

  if (!Number.isInteger(index) || !field) {
    return;
  }

  draftSubjects[index][field] = event.target.value;
  const band = getGradeBand(clampScore(draftSubjects[index].score));
  const summary = row.querySelector(".subject-row-summary");
  if (summary) {
    summary.innerHTML = `<span>Grade ${band.grade}</span><span>${band.remark}</span>`;
  }
  renderDraftSummary();
}

function handleSubjectRowClick(event) {
  const button = event.target.closest("button[data-index]");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) {
    return;
  }

  draftSubjects = draftSubjects.filter((_, itemIndex) => itemIndex !== index);
  if (!draftSubjects.length) {
    draftSubjects = [{ name: "", score: "" }];
  }
  renderSubjectRows();
  renderDraftSummary();
}

function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (!id) {
    return;
  }

  if (action === "preview") {
    state.selectedStudentId = id;
    persistState();
    renderAll();
    return;
  }

  if (action === "edit") {
    const student = state.students.find((item) => item.id === id);
    if (!student) {
      return;
    }
    resetStudentForm(student);
    document.getElementById("studentFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (action === "delete") {
    const student = state.students.find((item) => item.id === id);
    if (!student) {
      return;
    }

    const confirmed = window.confirm(`Delete ${student.name}'s result record?`);
    if (!confirmed) {
      return;
    }

    state.students = state.students.filter((item) => item.id !== id);
    if (state.selectedStudentId === id) {
      state.selectedStudentId = state.students[0]?.id || null;
    }
    persistState();
    renderAll();
    resetStudentForm();
  }
}

function handleReportSelection(event) {
  state.selectedStudentId = event.target.value || null;
  persistState();
  renderReportPreview();
  renderRecordsTable();
}

function addDraftSubject() {
  draftSubjects = [...draftSubjects, { name: "", score: "" }];
  renderSubjectRows();
  renderDraftSummary();
}

function clearRecords() {
  const confirmed = window.confirm("Clear every saved student record from this device?");
  if (!confirmed) {
    return;
  }

  state.students = [];
  state.selectedStudentId = null;
  persistState();
  renderAll();
  resetStudentForm();
}

function loadDemoData() {
  state = createInitialState();
  editingStudentId = null;
  applySettingsToInputs();
  persistState();
  renderAll();
  resetStudentForm();
}

function printCurrentReport() {
  const rankedStudents = getRankedStudents();
  const selectedStudent = rankedStudents.find((student) => student.id === state.selectedStudentId);

  if (!selectedStudent) {
    window.alert("Select a student report first.");
    return;
  }

  document.body.classList.add("print-report-mode");
  window.print();
}

function exportData() {
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

function importData(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state = normalizeState(parsed.state || parsed);
      editingStudentId = null;
      applySettingsToInputs();
      persistState();
      renderAll();
      resetStudentForm();
    } catch (error) {
      window.alert("That file could not be imported. Please choose a valid AcademicEase JSON backup.");
    } finally {
      elements.importFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

function exportCsv() {
  const students = getRankedStudents();
  if (!students.length) {
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
    ...students.map((student) => [
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
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  downloadFile(`academicease-results-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv", csv);
}

function renderAll() {
  if (!state.selectedStudentId && state.students.length) {
    state.selectedStudentId = state.students[0].id;
    persistState();
  }

  renderSummaryCards();
  renderAnalytics();
  renderRecordsTable();
  renderReportSelect();
  renderReportPreview();
}

function renderSummaryCards() {
  const students = getRankedStudents();
  const summary = getSummary(students);

  const cards = [
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
      pill: `${summary.gradeDistribution[0]?.label || "No grades yet"}`,
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

  elements.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <span class="section-kicker">${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.detail}</p>
          <span class="pill">${card.pill}</span>
        </article>
      `,
    )
    .join("");
}

function renderAnalytics() {
  const students = getRankedStudents();
  const subjectInsights = getSubjectInsights(students);
  const gradeDistribution = getSummary(students).gradeDistribution;

  if (!students.length) {
    elements.analyticsPanel.innerHTML = createEmptyState(
      "Performance analytics will appear once student marks are entered.",
    );
    return;
  }

  const topStudents = students.slice(0, 3);

  elements.analyticsPanel.innerHTML = `
    <article class="analytics-card">
      <h3>Top Performers</h3>
      <div class="top-list">
        ${topStudents
          .map(
            (student) => `
              <div class="top-item">
                <div class="top-item-head">
                  <strong>${escapeHtml(student.name)}</strong>
                  <span class="score-pill">${student.average.toFixed(1)}%</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" style="width: ${student.average}%"></div>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>

    <article class="analytics-card">
      <h3>Grade Distribution</h3>
      <div class="distribution-list">
        ${gradeDistribution
          .map(
            (band) => `
              <div class="distribution-item">
                <div class="distribution-item-head">
                  <strong>Grade ${band.grade}</strong>
                  <span>${band.count} student${band.count === 1 ? "" : "s"}</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" style="width: ${band.percentage}%"></div>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>

    <article class="analytics-card">
      <h3>Subject Performance</h3>
      <div class="subject-list">
        ${subjectInsights
          .map(
            (subject) => `
              <div class="subject-item">
                <div class="subject-item-head">
                  <strong>${escapeHtml(subject.name)}</strong>
                  <span>${subject.average.toFixed(1)}% avg</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" style="width: ${subject.average}%"></div>
                </div>
                <div class="subject-row-summary">
                  <span>${subject.passRate.toFixed(0)}% pass rate</span>
                  <span>Highest ${subject.highest}%</span>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderSubjectRows() {
  elements.subjectRows.innerHTML = draftSubjects
    .map((subject, index) => {
      const score = Number(subject.score);
      const scoreDisplay = Number.isFinite(score) ? clampScore(score) : 0;
      const band = getGradeBand(scoreDisplay);

      return `
        <div class="subject-row" data-index="${index}">
          <label>
            <span>Subject Name</span>
            <input
              type="text"
              value="${escapeAttribute(subject.name)}"
              data-field="name"
              placeholder="e.g. Mathematics"
            />
          </label>
          <label>
            <span>Score</span>
            <input
              type="number"
              min="0"
              max="100"
              value="${escapeAttribute(subject.score)}"
              data-field="score"
              placeholder="0-100"
            />
          </label>
          <div>
            <button class="button ghost" type="button" data-index="${index}">Remove</button>
            <div class="subject-row-summary">
              <span>Grade ${band.grade}</span>
              <span>${band.remark}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDraftSummary() {
  const student = getStudentMetrics({
    name: "Draft",
    admissionNumber: "",
    gender: "",
    subjects: draftSubjects.filter((subject) => subject.name.trim()),
  });

  const cards = [
    { label: "Subjects", value: student.subjects.length },
    { label: "Total", value: student.total },
    { label: "Average", value: `${student.average.toFixed(1)}%` },
    { label: "Grade", value: `${student.grade} · ${student.remark}` },
  ];

  elements.draftSummary.innerHTML = cards
    .map(
      (card) => `
        <div class="draft-summary-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `,
    )
    .join("");
}

function renderRecordsTable() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  const students = getRankedStudents().filter((student) => {
    if (!searchTerm) {
      return true;
    }

    return (
      student.name.toLowerCase().includes(searchTerm) ||
      student.admissionNumber.toLowerCase().includes(searchTerm)
    );
  });

  if (!students.length) {
    elements.recordsTableBody.innerHTML = `
      <tr>
        <td colspan="9">
          ${createEmptyState(searchTerm ? "No student matched that search." : "No student records yet. Add results to begin.")}
        </td>
      </tr>
    `;
    return;
  }

  elements.recordsTableBody.innerHTML = students
    .map(
      (student) => `
        <tr class="${student.id === state.selectedStudentId ? "selected-row" : ""}">
          <td>${student.position}</td>
          <td>
            <strong>${escapeHtml(student.name)}</strong>
            <div class="table-tag">${escapeHtml(student.gender)}</div>
          </td>
          <td>${escapeHtml(student.admissionNumber)}</td>
          <td>${student.subjects.length}</td>
          <td>${student.total}</td>
          <td>${student.average.toFixed(1)}%</td>
          <td><span class="score-pill">Grade ${student.grade}</span></td>
          <td>${student.remark}</td>
          <td>
            <div class="table-actions">
              <button class="button secondary" type="button" data-action="preview" data-id="${student.id}">
                Preview
              </button>
              <button class="button secondary" type="button" data-action="edit" data-id="${student.id}">
                Edit
              </button>
              <button class="button ghost danger" type="button" data-action="delete" data-id="${student.id}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderReportSelect() {
  const students = getRankedStudents();

  if (!students.length) {
    elements.reportStudentSelect.innerHTML = `<option value="">No reports available</option>`;
    elements.reportStudentSelect.value = "";
    return;
  }

  elements.reportStudentSelect.innerHTML = students
    .map(
      (student) => `
        <option value="${student.id}" ${student.id === state.selectedStudentId ? "selected" : ""}>
          ${escapeHtml(student.name)} (${escapeHtml(student.admissionNumber)})
        </option>
      `,
    )
    .join("");
}

function renderReportPreview() {
  const students = getRankedStudents();
  const selectedStudent = students.find((student) => student.id === state.selectedStudentId);

  if (!selectedStudent) {
    elements.reportPreview.innerHTML = createEmptyState(
      "Choose or create a student result to generate a report card.",
    );
    return;
  }

  const printDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
  }).format(new Date());

  elements.reportPreview.innerHTML = `
    <article class="report-card">
      <div class="report-top">
        <div>
          <span class="section-kicker">Official Result Slip</span>
          <h3>${escapeHtml(state.settings.schoolName)}</h3>
          <p>${escapeHtml(state.settings.className)} · ${escapeHtml(state.settings.term)} · ${escapeHtml(state.settings.year)}</p>
        </div>
        <div class="report-meta">
          <div class="report-meta-item">
            <span class="section-kicker">Generated</span>
            <p>${printDate}</p>
          </div>
          <div class="report-meta-item">
            <span class="section-kicker">Standing</span>
            <p>Position ${selectedStudent.position} of ${students.length}</p>
          </div>
        </div>
      </div>

      <div class="report-student-grid">
        <div class="report-student-card">
          <span>Student Name</span>
          <strong>${escapeHtml(selectedStudent.name)}</strong>
        </div>
        <div class="report-student-card">
          <span>Admission Number</span>
          <strong>${escapeHtml(selectedStudent.admissionNumber)}</strong>
        </div>
        <div class="report-student-card">
          <span>Gender</span>
          <strong>${escapeHtml(selectedStudent.gender)}</strong>
        </div>
        <div class="report-student-card">
          <span>Performance Band</span>
          <strong class="report-badge">Grade ${selectedStudent.grade}</strong>
        </div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          ${selectedStudent.subjects
            .map((subject) => {
              const band = getGradeBand(subject.score);
              return `
                <tr>
                  <td>${escapeHtml(subject.name)}</td>
                  <td>${subject.score}%</td>
                  <td>${band.grade}</td>
                  <td>${band.remark}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>

      <div class="report-overview">
        <div class="report-overview-card">
          <span>Total Marks</span>
          <strong>${selectedStudent.total}</strong>
        </div>
        <div class="report-overview-card">
          <span>Average Score</span>
          <strong>${selectedStudent.average.toFixed(1)}%</strong>
        </div>
        <div class="report-overview-card">
          <span>Subjects Passed</span>
          <strong>${selectedStudent.passedSubjects}</strong>
        </div>
        <div class="report-overview-card">
          <span>Teacher Remark</span>
          <strong>${selectedStudent.remark}</strong>
        </div>
      </div>

      <div class="report-footer">
        <div class="report-meta-item">
          <span class="section-kicker">Summary</span>
          <p>
            ${escapeHtml(selectedStudent.name)} achieved an overall average of
            ${selectedStudent.average.toFixed(1)}%, earning Grade ${selectedStudent.grade}.
            This report is ready to print or save as PDF from the browser.
          </p>
        </div>
        <div class="signature-blocks">
          <div class="signature">Class Teacher Signature</div>
          <div class="signature">Principal Signature</div>
        </div>
      </div>
    </article>
  `;
}

function resetStudentForm(student = null) {
  editingStudentId = student?.id || null;
  elements.studentNameInput.value = student?.name || "";
  elements.admissionNumberInput.value = student?.admissionNumber || "";
  elements.genderInput.value = student?.gender || "Female";
  elements.studentFormTitle.textContent = editingStudentId ? "Edit Student Results" : "Add Student Results";
  elements.studentFormSubtitle.textContent = editingStudentId
    ? "Update the selected student record and save your changes."
    : "Enter student information and subject scores.";
  elements.saveStudentBtn.textContent = editingStudentId ? "Update Result" : "Save Result";
  draftSubjects = student
    ? student.subjects.map((subject) => ({
        name: subject.name,
        score: String(subject.score),
      }))
    : createDraftSubjects();
  renderSubjectRows();
  renderDraftSummary();
}

function getRankedStudents() {
  return state.students
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

function getStudentMetrics(student) {
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

function getSummary(students) {
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

function getSubjectInsights(students) {
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

function getGradeBand(score) {
  return gradeBands.find((band) => score >= band.min) || gradeBands[gradeBands.length - 1];
}

function createDraftSubjects() {
  return SUBJECT_TEMPLATE.map((name) => ({ name, score: "" }));
}

function createInitialState() {
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

function createStudent(name, admissionNumber, gender, scores) {
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

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return createInitialState();
  }
}

function normalizeState(raw) {
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

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applySettingsToInputs() {
  elements.schoolNameInput.value = state.settings.schoolName;
  elements.classNameInput.value = state.settings.className;
  elements.termInput.value = state.settings.term;
  elements.yearInput.value = state.settings.year;
}

function createEmptyState(message) {
  return `
    <div class="empty-state">
      <div>
        <strong>Nothing to show yet</strong>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(number)));
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `student-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}
