const STATE_COMPARISON_URL = "https://reports.ecs.org/comparisons/high-school-graduation-requirements-2023-04";
const STORAGE_KEY = "gradpath-homeschool-data-v1";
const DEFAULT_GRADING_SCALE = { a: 90, b: 80, c: 70, d: 60 };
const STATE_SUGGESTIONS = [
  { match: /english|language arts/i, examples: ["English", "American literature", "Composition"] },
  { match: /math/i, examples: ["Algebra", "Geometry", "Statistics"] },
  { match: /social studies|history|humanities/i, examples: ["World history", "U.S. history", "Civics"] },
  { match: /science|stem/i, examples: ["Biology", "Chemistry", "Physics"] },
  { match: /physical education|health/i, examples: ["Physical education", "Health"] },
  { match: /language/i, examples: ["Spanish", "French", "American Sign Language"] },
  { match: /art|music/i, examples: ["Studio art", "Music", "Theater"] },
  { match: /career|cte|technology/i, examples: ["Career exploration", "Computer science", "Woodworking"] },
  { match: /elective/i, examples: ["Personal finance", "Psychology", "Creative writing"] },
];

const appMessage = document.querySelector("#app-message");

let stateProfiles = [];
let family = null;
let students = [];
let requirements = [];
let courses = [];
let recordsByStudent = {};
let activeStudentId = null;
let editingCourseId = null;
let editingRequirementId = null;
let currentFilter = "all";

const el = {
  stateSelect: document.querySelector("#state-select"),
  stateSourceNote: document.querySelector("#state-source-note"),
  stateDisclaimer: document.querySelector("#state-disclaimer"),
  studentNav: document.querySelector("#student-nav"),
  breadcrumbName: document.querySelector("#breadcrumb-name"),
  pageTitle: document.querySelector("#page-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  creditsCompleted: document.querySelector("#credits-completed"),
  creditsRequired: document.querySelector("#credits-required"),
  creditsRemaining: document.querySelector("#credits-remaining"),
  requiredCaption: document.querySelector("#required-caption"),
  overallAverage: document.querySelector("#overall-average"),
  requirementsList: document.querySelector("#requirements-list"),
  studentName: document.querySelector("#student-name"),
  courseFilter: document.querySelector("#course-filter"),
  courseList: document.querySelector("#course-list"),
  emptyState: document.querySelector("#empty-state"),
  studentDialog: document.querySelector("#student-dialog"),
  studentForm: document.querySelector("#student-form"),
  studentError: document.querySelector("#student-error"),
  courseDialog: document.querySelector("#course-dialog"),
  courseForm: document.querySelector("#course-form"),
  courseError: document.querySelector("#course-error"),
  courseRequirement: document.querySelector("#course-requirement"),
  courseSuggestions: document.querySelector("#course-suggestions"),
  courseGradePercent: document.querySelector("#course-grade-percent"),
  letterGradePreview: document.querySelector("#letter-grade-preview"),
  requirementDialog: document.querySelector("#requirement-dialog"),
  requirementForm: document.querySelector("#requirement-form"),
  requirementError: document.querySelector("#requirement-error"),
  requirementDialogTitle: document.querySelector("#requirement-dialog-title"),
  gradingDialog: document.querySelector("#grading-dialog"),
  gradingForm: document.querySelector("#grading-form"),
  gradingError: document.querySelector("#grading-error"),
};

function setMessage(target, message = "", isError = false) {
  target.textContent = message;
  target.classList.toggle("error", isError);
}

function runSafely(context, action, target = appMessage) {
  void Promise.resolve()
    .then(action)
    .catch((error) => {
      console.error(`${context}:`, error);
      setMessage(target, `${context}: ${error.message}`, true);
    });
}

function handleFormSubmit(event, context, action, target = appMessage) {
  event.preventDefault();
  runSafely(context, () => action(event), target);
}

function persistFamily() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    family,
    students,
    recordsByStudent,
  }));
}

function formatCredits(value) {
  return Number(Number(value).toFixed(2)).toString();
}

function formatPercent(value) {
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function getProfile(code = family?.state_code) {
  return stateProfiles.find((profile) => profile.code === code) ?? null;
}

function getStudent() {
  return students.find((student) => student.id === activeStudentId) ?? null;
}

function getRequirement(requirementId) {
  return requirements.find((requirement) => requirement.id === requirementId) ?? null;
}

function getCoursesForRequirement(requirementId) {
  return courses.filter((course) => course.requirement_id === requirementId);
}

function getWeightedAverage(rows) {
  const graded = rows.filter((row) => row.grade_percent !== null && row.grade_percent !== undefined);
  const totalCredits = graded.reduce((total, row) => total + Number(row.credits), 0);
  if (totalCredits === 0) return null;
  return graded.reduce((total, row) => total + Number(row.grade_percent) * Number(row.credits), 0) / totalCredits;
}

function getLetterGrade(percent, scale = family?.grading_scale ?? DEFAULT_GRADING_SCALE) {
  if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) return "";
  const grade = Number(percent);
  if (grade >= Number(scale.a)) return "A";
  if (grade >= Number(scale.b)) return "B";
  if (grade >= Number(scale.c)) return "C";
  if (grade >= Number(scale.d)) return "D";
  return "F";
}

function suggestedClasses(category) {
  return STATE_SUGGESTIONS.find((item) => item.match.test(category))?.examples ?? ["Parent-selected course"];
}

function profileRequirements(code) {
  return getProfile(code)?.requirements ?? [];
}

function updateStateSelector() {
  const previousValue = family?.state_code ?? "";
  el.stateSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a state";
  el.stateSelect.append(placeholder);
  for (const profile of stateProfiles) {
    const option = document.createElement("option");
    option.value = profile.code;
    option.textContent = profile.name;
    el.stateSelect.append(option);
  }
  el.stateSelect.value = previousValue;
  updateStateSource();
}

function updateStateSource() {
  const profile = getProfile();
  el.stateSourceNote.replaceChildren();
  if (!profile) {
    el.stateSourceNote.textContent = "Choose a state to load its public-school reference.";
    el.stateDisclaimer.replaceChildren();
    return;
  }
  const sourceLabel = document.createElement("span");
  sourceLabel.textContent = "Public-school profile · May 2023 comparison";
  const sourceLink = document.createElement("a");
  sourceLink.href = profile.officialSourceUrl || profile.comparisonUrl || STATE_COMPARISON_URL;
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.textContent = "View source";
  el.stateSourceNote.append(sourceLabel, document.createTextNode(" "), sourceLink);

  const strong = document.createElement("strong");
  strong.textContent = `${profile.name} public-school reference only. `;
  const detail = document.createTextNode(
    `This profile summarizes published public-school credit guidance from a May 2023 national comparison. It may be outdated, and public-school rules do not necessarily apply to homeschool families. Local, pathway, and graduating-cohort rules may differ.${profile.referenceNote ? ` ${profile.referenceNote}` : ""} Check the linked source and edit each student's family plan as needed.`,
  );
  const source = document.createElement("a");
  source.href = profile.comparisonUrl || STATE_COMPARISON_URL;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = "Comparison details";
  el.stateDisclaimer.replaceChildren(strong, detail, document.createTextNode(" "), source, document.createTextNode("."));
}

function setActiveStudent(id) {
  if (activeStudentId === id) return;
  activeStudentId = id;
  runSafely("Could not load this student's records", loadStudentData);
}

function renderStudents() {
  el.studentNav.replaceChildren();
  for (const student of students) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-current", String(student.id === activeStudentId));
    const avatar = document.createElement("span");
    avatar.className = "student-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = student.name.trim().charAt(0).toUpperCase();
    const label = document.createElement("span");
    label.textContent = `${student.name} · Grade ${student.grade_level}`;
    button.append(avatar, label);
    button.addEventListener("click", () => setActiveStudent(student.id));
    item.append(button);
    el.studentNav.append(item);
  }
}

function renderSummary(student) {
  const completed = courses.filter((course) => course.status === "completed")
    .reduce((total, course) => total + Number(course.credits), 0);
  const required = requirements.reduce((total, requirement) => total + Number(requirement.required_credits), 0);
  el.creditsCompleted.textContent = formatCredits(completed);
  el.creditsRequired.textContent = formatCredits(required);
  el.creditsRemaining.textContent = formatCredits(Math.max(0, required - completed));
  el.requiredCaption.textContent = student ? `${student.name}'s editable family plan` : "Editable family plan";
  const average = getWeightedAverage(courses);
  el.overallAverage.textContent = average === null ? "—" : `${formatPercent(average)} · ${getLetterGrade(average)}`;
}

function renderRequirements() {
  el.requirementsList.replaceChildren();
  for (const requirement of requirements) {
    const linkedCourses = getCoursesForRequirement(requirement.id);
    const earned = linkedCourses
      .filter((course) => course.status === "completed")
      .reduce((total, course) => total + Number(course.credits), 0);
    const target = Number(requirement.required_credits);
    const remaining = Math.max(0, target - earned);
    const ratio = target > 0 ? Math.min(100, earned / target * 100) : 100;
    const card = document.createElement("article");
    card.className = "requirement-card";

    const top = document.createElement("div");
    top.className = "requirement-top";
    const heading = document.createElement("div");
    heading.className = "requirement-heading";
    const title = document.createElement("h3");
    title.textContent = requirement.name;
    const details = document.createElement("p");
    const average = getWeightedAverage(linkedCourses);
    details.textContent = `${formatCredits(earned)} completed · ${formatCredits(remaining)} still needed${average === null ? "" : ` · Average ${formatPercent(average)} (${getLetterGrade(average)})`}`;
    heading.append(title, details);
    const counts = document.createElement("span");
    counts.className = "requirement-count";
    counts.textContent = `${formatCredits(earned)} / ${formatCredits(target)} credits`;
    top.append(heading, counts);

    const track = document.createElement("div");
    track.className = "requirement-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${requirement.name} credits completed`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(target));
    track.setAttribute("aria-valuenow", String(Math.min(earned, target)));
    const bar = document.createElement("span");
    bar.style.width = `${ratio}%`;
    track.append(bar);

    const examples = document.createElement("ul");
    examples.className = "suggestion-list";
    for (const example of suggestedClasses(requirement.name)) {
      const item = document.createElement("li");
      item.textContent = example;
      examples.append(item);
    }
    const actions = document.createElement("div");
    actions.className = "requirement-actions";
    const edit = document.createElement("button");
    edit.className = "small-action";
    edit.type = "button";
    edit.textContent = "Edit requirement";
    edit.addEventListener("click", () => openRequirementDialog(requirement));
    const remove = document.createElement("button");
    remove.className = "small-action danger";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => runSafely("Could not remove requirement", () => removeRequirement(requirement)));
    actions.append(edit, remove);

    card.append(top, track, examples, actions);
    el.requirementsList.append(card);
  }
  if (!requirements.length && getStudent()) {
    const message = document.createElement("p");
    message.className = "field-hint";
    message.textContent = "This state profile has no statewide numeric credit schedule in the source. Add the requirements your family will use.";
    el.requirementsList.append(message);
  }
}

function renderCourse(course) {
  const card = document.createElement("article");
  card.className = "course-card";
  const main = document.createElement("div");
  main.className = "course-main";
  const titleRow = document.createElement("div");
  titleRow.className = "course-title-row";
  const title = document.createElement("h3");
  title.className = "course-title";
  title.textContent = course.title;
  const badge = document.createElement("span");
  badge.className = `status-badge ${course.status}`;
  badge.textContent = course.status === "in_progress" ? "In progress" : course.status[0].toUpperCase() + course.status.slice(1);
  titleRow.append(title, badge);
  const requirement = getRequirement(course.requirement_id);
  const meta = document.createElement("div");
  meta.className = "course-meta";
  const category = document.createElement("span");
  category.textContent = requirement?.name ?? "Unassigned category";
  const credit = document.createElement("span");
  credit.textContent = `${formatCredits(course.credits)} ${Number(course.credits) === 1 ? "credit" : "credits"}`;
  const year = document.createElement("span");
  year.textContent = course.school_year;
  meta.append(category, credit, year);
  main.append(titleRow, meta);

  const grade = document.createElement("div");
  grade.className = "course-grade";
  if (course.grade_percent === null || course.grade_percent === undefined) {
    grade.textContent = "—";
    const noGrade = document.createElement("small");
    noGrade.textContent = "No grade";
    grade.append(noGrade);
  } else {
    const percent = Number(course.grade_percent);
    grade.textContent = `${formatPercent(percent)} · ${getLetterGrade(percent)}`;
    const gradeCaption = document.createElement("small");
    gradeCaption.textContent = "Current grade";
    grade.append(gradeCaption);
  }

  const actions = document.createElement("div");
  actions.className = "course-actions";
  const edit = document.createElement("button");
  edit.className = "small-action";
  edit.type = "button";
  edit.textContent = "Edit class";
  edit.addEventListener("click", () => openCourseDialog(course));
  const remove = document.createElement("button");
  remove.className = "small-action danger";
  remove.type = "button";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => runSafely("Could not delete class", () => removeCourse(course)));
  actions.append(edit, remove);
  card.append(main, grade, actions);
  return card;
}

function renderCourses() {
  el.courseList.replaceChildren();
  const visibleCourses = courses
    .filter((course) => currentFilter === "all" || course.status === currentFilter)
    .sort((a, b) => b.school_year.localeCompare(a.school_year) || a.title.localeCompare(b.title));
  for (const course of visibleCourses) el.courseList.append(renderCourse(course));
  el.emptyState.hidden = !getStudent() || courses.length > 0;
  if (courses.length > 0 && visibleCourses.length === 0) {
    const message = document.createElement("p");
    message.className = "field-hint";
    message.textContent = "No classes match this status.";
    el.courseList.append(message);
  }
}

function renderDashboard() {
  const student = getStudent();
  renderStudents();
  renderSummary(student);
  renderRequirements();
  renderCourses();
  el.breadcrumbName.textContent = student?.name ?? "Family overview";
  el.pageTitle.textContent = student ? `${student.name}'s graduation progress` : "Graduation progress";
  el.pageSubtitle.textContent = student
    ? `Grade ${student.grade_level}${student.graduation_year ? ` · Expected graduation ${student.graduation_year}` : ""}`
    : "Add a student to start building a family graduation plan.";
  el.studentName.textContent = student ? `for ${student.name}` : "";
  document.querySelector("#add-course").disabled = !student;
  document.querySelector("#add-requirement").disabled = !student;
}

function normalizeScale(scale) {
  const candidate = scale && typeof scale === "object" ? scale : DEFAULT_GRADING_SCALE;
  const normalized = {
    a: Number(candidate.a),
    b: Number(candidate.b),
    c: Number(candidate.c),
    d: Number(candidate.d),
  };
  return isValidScale(normalized) ? normalized : { ...DEFAULT_GRADING_SCALE };
}

function isValidScale(scale) {
  return ["a", "b", "c", "d"].every((key) => Number.isFinite(Number(scale[key])) && Number(scale[key]) >= 0 && Number(scale[key]) <= 100) &&
    Number(scale.a) > Number(scale.b) && Number(scale.b) > Number(scale.c) && Number(scale.c) > Number(scale.d);
}

function loadFamily() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    family = {
      id: crypto.randomUUID(),
      state_code: null,
      grading_scale: { ...DEFAULT_GRADING_SCALE },
    };
    students = [];
    recordsByStudent = {};
    persistFamily();
  } else {
    const data = JSON.parse(saved);
    if (data?.version !== 1 || !data.family || !Array.isArray(data.students) ||
      !data.recordsByStudent || typeof data.recordsByStudent !== "object" || Array.isArray(data.recordsByStudent)) {
      throw new Error("Saved GradPath data is invalid or from an unsupported version. It was left unchanged.");
    }
    family = {
      id: data.family.id,
      state_code: data.family.state_code ?? null,
      grading_scale: normalizeScale(data.family.grading_scale),
    };
    students = data.students;
    recordsByStudent = data.recordsByStudent;
    if (students.some((student) => !student?.id || !Array.isArray(recordsByStudent[student.id]?.requirements) ||
      !Array.isArray(recordsByStudent[student.id]?.courses))) {
      throw new Error("Saved student records are incomplete or invalid. They were left unchanged.");
    }
  }
  activeStudentId = students[0]?.id ?? null;
  updateStateSelector();
  loadStudentData();
}

function loadStudentData() {
  const student = getStudent();
  if (!student) {
    requirements = [];
    courses = [];
    renderDashboard();
    return;
  }
  const records = recordsByStudent[student.id];
  requirements = [...records.requirements].sort((a, b) => a.sort_order - b.sort_order);
  courses = [...records.courses];
  renderDashboard();
}

async function initialize() {
  const profileResponse = await fetch("./state-requirements.json");
  if (!profileResponse.ok) throw new Error(`State profiles could not be loaded (${profileResponse.status}).`);
  stateProfiles = await profileResponse.json();
  if (!Array.isArray(stateProfiles) || stateProfiles.length !== 50) {
    throw new Error("The state reference file must contain exactly 50 state profiles.");
  }

  loadFamily();
}

function changeFamilyState(code) {
  if (!family || code === family.state_code) return;
  family.state_code = code || null;
  persistFamily();
  updateStateSelector();
  setMessage(appMessage, "Family state updated. Existing student plans were kept; review or edit their requirements as needed.");
}

function openStudentDialog() {
  el.studentForm.reset();
  el.studentError.textContent = "";
  el.studentDialog.showModal();
  document.querySelector("#student-name-input").focus();
}

function schoolYearNow() {
  const today = new Date();
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return `${startYear}–${startYear + 1}`;
}

function populateRequirementOptions(selectedId = "") {
  el.courseRequirement.replaceChildren();
  for (const requirement of requirements) {
    const option = document.createElement("option");
    option.value = requirement.id;
    option.textContent = requirement.name;
    option.selected = requirement.id === selectedId;
    el.courseRequirement.append(option);
  }
  updateCourseSuggestions();
}

function updateCourseSuggestions() {
  const requirement = getRequirement(el.courseRequirement.value);
  if (!requirement) {
    el.courseSuggestions.textContent = "Add a requirement before assigning this class.";
    return;
  }
  el.courseSuggestions.textContent = `${suggestedClasses(requirement.name).join(", ")}. Examples only; parents decide how courses count for their family.`;
}

function openCourseDialog(course = null) {
  if (!getStudent()) {
    setMessage(appMessage, "Add a student before entering classes.", true);
    return;
  }
  if (!requirements.length) {
    setMessage(appMessage, "Add at least one subject requirement before entering a class.", true);
    openRequirementDialog();
    return;
  }
  editingCourseId = course?.id ?? null;
  el.courseForm.reset();
  el.courseError.textContent = "";
  populateRequirementOptions(course?.requirement_id ?? requirements[0].id);
  document.querySelector("#course-dialog-title").textContent = course ? "Edit class" : "Add a class";
  el.courseForm.querySelector("button[type=submit]").textContent = course ? "Save changes" : "Save class";
  document.querySelector("#course-title").value = course?.title ?? "";
  document.querySelector("#course-credits").value = course?.credits ?? "1";
  document.querySelector("#course-status").value = course?.status ?? "planned";
  document.querySelector("#course-year").value = course?.school_year ?? schoolYearNow();
  el.courseGradePercent.value = course?.grade_percent ?? "";
  updateLetterGradePreview();
  el.courseDialog.showModal();
  document.querySelector("#course-title").focus();
}

function updateLetterGradePreview() {
  const value = el.courseGradePercent.value;
  el.letterGradePreview.textContent = value === ""
    ? "Enter a percentage to see the letter grade."
    : `${formatPercent(value)} is a ${getLetterGrade(value)} on this family's current grading scale.`;
}

function openRequirementDialog(requirement = null) {
  if (!getStudent()) {
    setMessage(appMessage, "Add a student before editing graduation requirements.", true);
    return;
  }
  editingRequirementId = requirement?.id ?? null;
  el.requirementForm.reset();
  el.requirementError.textContent = "";
  el.requirementDialogTitle.textContent = requirement ? "Edit requirement" : "Add a requirement";
  el.requirementForm.querySelector("button[type=submit]").textContent = requirement ? "Save changes" : "Save requirement";
  document.querySelector("#requirement-name").value = requirement?.name ?? "";
  document.querySelector("#requirement-credits").value = requirement?.required_credits ?? "";
  el.requirementDialog.showModal();
  document.querySelector("#requirement-name").focus();
}

function openGradingDialog() {
  const scale = normalizeScale(family?.grading_scale);
  for (const key of ["a", "b", "c", "d"]) document.querySelector(`#cutoff-${key}`).value = String(scale[key]);
  el.gradingError.textContent = "";
  el.gradingDialog.showModal();
}

function submitStudent(event) {
  event.preventDefault();
  const form = new FormData(el.studentForm);
  const name = String(form.get("name")).trim();
  const gradeLevel = Number(form.get("grade"));
  const graduationYearValue = String(form.get("graduation_year")).trim();
  if (!name || !Number.isInteger(gradeLevel) || gradeLevel < 9 || gradeLevel > 12) {
    setMessage(el.studentError, "Enter a name and choose a high-school grade level.", true);
    return;
  }
  const student = {
    id: crypto.randomUUID(),
    name,
    grade_level: gradeLevel,
    graduation_year: graduationYearValue ? Number(graduationYearValue) : null,
    created_at: new Date().toISOString(),
  };
  const preset = profileRequirements(family.state_code);
  const initialRequirements = preset.map((requirement, index) => ({
      id: crypto.randomUUID(),
      name: requirement.name,
      required_credits: requirement.credits,
      sort_order: index,
    }));
  students.push(student);
  recordsByStudent[student.id] = { requirements: initialRequirements, courses: [] };
  persistFamily();
  el.studentDialog.close();
  activeStudentId = student.id;
  loadStudentData();
  setMessage(appMessage, preset.length
    ? `${name}'s plan started with ${getProfile()?.name} public-school reference categories. Edit them for your family's plan.`
    : `${name} was added. Add the requirements your family will use.`);
}

function submitCourse(event) {
  event.preventDefault();
  const student = getStudent();
  if (!student) return;
  const form = new FormData(el.courseForm);
  const gradeValue = String(form.get("grade_percent")).trim();
  const gradePercent = gradeValue ? Number(gradeValue) : null;
  const course = {
    id: editingCourseId ?? crypto.randomUUID(),
    requirement_id: String(form.get("requirement_id")),
    title: String(form.get("title")).trim(),
    credits: Number(form.get("credits")),
    status: String(form.get("status")),
    grade_percent: gradePercent,
    school_year: String(form.get("school_year")).trim(),
    created_at: editingCourseId
      ? courses.find((item) => item.id === editingCourseId)?.created_at
      : new Date().toISOString(),
  };
  if (!course.title || !course.school_year || !Number.isFinite(course.credits) || course.credits <= 0 ||
    !["planned", "in_progress", "completed"].includes(course.status) ||
    (gradePercent !== null && (!Number.isFinite(gradePercent) || gradePercent < 0 || gradePercent > 100))) {
    setMessage(el.courseError, "Check the class name, credits, school year, status, and percentage grade.", true);
    return;
  }
  courses = editingCourseId
    ? courses.map((item) => item.id === editingCourseId ? course : item)
    : [...courses, course];
  recordsByStudent[student.id].courses = courses;
  persistFamily();
  el.courseDialog.close();
  setMessage(appMessage, editingCourseId ? "Class updated." : "Class added.");
  editingCourseId = null;
  loadStudentData();
}

function submitRequirement(event) {
  event.preventDefault();
  const student = getStudent();
  if (!student) return;
  const form = new FormData(el.requirementForm);
  const name = String(form.get("name")).trim();
  const requiredCredits = Number(form.get("required_credits"));
  if (!name || !Number.isFinite(requiredCredits) || requiredCredits < 0 || requiredCredits > 100) {
    setMessage(el.requirementError, "Enter a category name and a credit requirement from 0 to 100.", true);
    return;
  }
  const requirement = {
    id: editingRequirementId ?? crypto.randomUUID(),
    name,
    required_credits: requiredCredits,
    sort_order: editingRequirementId
      ? getRequirement(editingRequirementId).sort_order
      : requirements.length,
  };
  requirements = editingRequirementId
    ? requirements.map((item) => item.id === editingRequirementId ? requirement : item)
    : [...requirements, requirement];
  recordsByStudent[student.id].requirements = requirements;
  persistFamily();
  el.requirementDialog.close();
  setMessage(appMessage, editingRequirementId ? "Requirement updated." : "Requirement added.");
  editingRequirementId = null;
  loadStudentData();
}

function saveGradingScale(event) {
  event.preventDefault();
  const form = new FormData(el.gradingForm);
  const scale = Object.fromEntries(["a", "b", "c", "d"].map((key) => [key, Number(form.get(key))]));
  if (!isValidScale(scale)) {
    setMessage(el.gradingError, "Cutoffs must be between 0 and 100 and descend from A to D.", true);
    return;
  }
  family.grading_scale = scale;
  persistFamily();
  el.gradingDialog.close();
  renderDashboard();
  setMessage(appMessage, "Grading scale updated.");
}

function removeCourse(course) {
  if (!window.confirm(`Delete “${course.title}” from this student's course records?`)) return;
  courses = courses.filter((item) => item.id !== course.id);
  recordsByStudent[activeStudentId].courses = courses;
  persistFamily();
  setMessage(appMessage, "Class deleted.");
  loadStudentData();
}

function removeRequirement(requirement) {
  const related = getCoursesForRequirement(requirement.id).length;
  const detail = related ? ` ${related} class${related === 1 ? " is" : "es are"} assigned to it and will become unassigned.` : "";
  if (!window.confirm(`Remove the “${requirement.name}” requirement?${detail}`)) return;
  requirements = requirements.filter((item) => item.id !== requirement.id);
  courses = courses.map((course) => course.requirement_id === requirement.id
    ? { ...course, requirement_id: null }
    : course);
  recordsByStudent[activeStudentId].requirements = requirements;
  recordsByStudent[activeStudentId].courses = courses;
  persistFamily();
  setMessage(appMessage, "Requirement removed.");
  loadStudentData();
}

function wireEvents() {
  document.querySelector("#state-select").addEventListener("change", (event) => runSafely("Could not save family state", () => changeFamilyState(event.target.value)));
  document.querySelector("#add-student").addEventListener("click", openStudentDialog);
  document.querySelector("#add-student-main").addEventListener("click", openStudentDialog);
  document.querySelector("#add-course").addEventListener("click", () => openCourseDialog());
  document.querySelector("#empty-add-course").addEventListener("click", () => openCourseDialog());
  document.querySelector("#add-requirement").addEventListener("click", () => openRequirementDialog());
  document.querySelector("#grading-settings").addEventListener("click", openGradingDialog);
  document.querySelector("#print-report").addEventListener("click", () => window.print());
  el.courseFilter.addEventListener("change", (event) => {
    currentFilter = event.target.value;
    renderCourses();
  });
  el.courseRequirement.addEventListener("change", updateCourseSuggestions);
  el.courseGradePercent.addEventListener("input", updateLetterGradePreview);
  el.studentForm.addEventListener("submit", (event) => handleFormSubmit(event, "Could not add student", submitStudent));
  el.courseForm.addEventListener("submit", (event) => handleFormSubmit(event, "Could not save class", submitCourse));
  el.requirementForm.addEventListener("submit", (event) => handleFormSubmit(event, "Could not save requirement", submitRequirement));
  el.gradingForm.addEventListener("submit", (event) => handleFormSubmit(event, "Could not save grading scale", saveGradingScale));
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.close).close());
  });
  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

wireEvents();

try {
  await initialize();
} catch (error) {
  console.error("GradPath could not start:", error);
  setMessage(appMessage, `GradPath could not start: ${error.message}`, true);
  document.querySelectorAll("button, input, select").forEach((control) => {
    control.disabled = true;
  });
}
