// Proměnné pro uchování stavu aplikace
let selectedList = null;
let selectedTaskId = null;
let selectedTask = null;
let currentView = "list";
let currentSort = "due_asc";

// DOM elementy pro interakci s uživatelem
const quickViewAllButton = document.getElementById("quick-view-all");
const quickViewCurrentDayButton = document.getElementById(
  "quick-view-current-day",
);
const quickViewOverdueButton = document.getElementById("quick-view-overdue");
const quickViewImportantButton = document.getElementById(
  "quick-view-important",
);
const quickViewCompletedButton = document.getElementById(
  "quick-view-completed",
);
const taskSortSelect = document.getElementById("task-sort");
const taskReminderInput = document.getElementById("task-reminder");
const clearReminderButton = document.getElementById("clear-reminder-btn");
const deleteSelectedTaskButton = document.getElementById(
  "delete-selected-task-btn",
);
const taskTitleInput = document.getElementById("task-title");
const taskDueInput = document.getElementById("task-due");
const newTaskInput = document.getElementById("task-title-input");
const newTasklistInput = document.getElementById("tasklist-title");
const taskListContainer = document.getElementById("tasks-list");
const todolistsContainer = document.getElementById("todolists-list");
const saveTaskButton = document.getElementById("save-task-btn");
const addTaskButton = document.getElementById("add-task-btn");
const addTasklistButton = document.getElementById("add-tasklist-btn");
const errorModal = document.getElementById("error-modal");
const errorModalMessage = document.getElementById("error-modal-message");
const errorModalClose = document.getElementById("error-modal-close");

// Funkce pro zobrazení chybového modalu s danou zprávou
function showErrorModal(message) {
  errorModalMessage.textContent = message;
  errorModal.classList.add("active");
}

errorModalClose.onclick = () => {
  errorModal.classList.remove("active");
};

function updateClearReminderVisibility() {
  clearReminderButton.style.display = taskReminderInput.value
    ? "block"
    : "none";
}

// Funkce pro převod z UTC ISO formátu do lokálního formátu pro input typu date
function toLocalDateString(dateInput = new Date()) {
  const dateObj = new Date(dateInput);
  if (Number.isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Funkce pro převod z utc ISO formátu do lokálního formátu pro input typu datetime-local
function utcIsoToLocalDateTime(dateInput) {
  if (!dateInput) return "";
  const dateObj = new Date(dateInput);
  if (Number.isNaN(dateObj.getTime())) return "";

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Funkce pro převod z lokálního formátu pro input typu datetime-local do UTC ISO formátu
function localDateTimeToUtcIso(value) {
  if (!value) return null;
  const dateObj = new Date(value);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
}

// Nastavení řazení úkolů pro API podle volby v uživatelském rozhraní
function setupTaskSort() {
  if (!taskSortSelect) {
    return;
  }

  taskSortSelect.value = currentSort;
  taskSortSelect.onchange = () => {
    currentSort = taskSortSelect.value || "due_asc";
    loadTasksForView();
  };
}

// Načtení seznamů úkolů ze serveru
async function loadTodolists() {
  try {
    const response = await fetch("/api/todo/lists");
    if (!response.ok) throw new Error("Failed to load lists");
    const lists = await response.json();
    todolistsContainer.innerHTML = "";

    if (!lists || lists.length === 0) {
      return;
    }

    lists.forEach((list) => {
      const div = document.createElement("div");
      div.className = "todolist-item";
      const title = document.createElement("span");
      title.className = "todolist-title";
      title.textContent = list.title;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "todolist-delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "✕";
      deleteBtn.onclick = (event) => {
        event.stopPropagation();
        deleteList(list);
      };

      div.onclick = () => selectList(list, div);
      div.appendChild(title);
      div.appendChild(deleteBtn);
      todolistsContainer.appendChild(div);
    });
  } catch (error) {
    showErrorModal("Error loading lists");
  }
}

// Nastavení tlačítek pro rychlé pohledy a spuštění funkce pro zobrazení úkolů podle vybraného pohledu
function setupQuickViews() {
  quickViewAllButton.onclick = () => {
    setQuickView("all");
  };

  quickViewCurrentDayButton.onclick = () => {
    setQuickView("currentDay");
  };

  quickViewOverdueButton.onclick = () => {
    setQuickView("overdue");
  };

  quickViewImportantButton.onclick = () => {
    setQuickView("important");
  };

  quickViewCompletedButton.onclick = () => {
    setQuickView("completed");
  };
}

// Nastavení aktuálního rychlého pohledu a načtení úkolů pro tento pohled
function setQuickView(view) {
  currentView = view;
  selectedList = null;
  selectedTaskId = null;
  clearListSelection();
  clearTaskEditor();
  updateQuickViewActive(view);
  updateTaskAddVisibility();

  // Zajistí načtení úkolů pouze pro validní rychlé pohledy
  const shouldLoadTasks =
    view === "all" ||
    view === "currentDay" ||
    view === "overdue" ||
    view === "important" ||
    view === "completed";

  if (shouldLoadTasks) {
    loadTasksForView();
    return;
  }

  taskListContainer.innerHTML = "";
}

// Zvýraznění aktivního rychlého pohledu v UI
function updateQuickViewActive(view) {
  quickViewAllButton.classList.toggle("active", view === "all");
  quickViewCurrentDayButton.classList.toggle("active", view === "currentDay");
  quickViewOverdueButton.classList.toggle("active", view === "overdue");
  quickViewImportantButton.classList.toggle("active", view === "important");
  quickViewCompletedButton.classList.toggle("active", view === "completed");
}

// Zrušení zvýraznění aktivního seznamu úkolů a zobrazení, že žádný seznam není vybrán
function clearListSelection() {
  document
    .querySelectorAll(".todolist-item")
    .forEach((el) => el.classList.remove("active"));
}

// Vyčistí editor úkolu a zruší zvýraznění aktivního úkolu
function clearTaskEditor() {
  selectedTaskId = null;
  selectedTask = null;
  taskTitleInput.value = "";
  taskDueInput.value = "";
  taskReminderInput.value = "";
  updateClearReminderVisibility();
  document
    .querySelectorAll(".task-item")
    .forEach((el) => el.classList.remove("active"));
}

function updateTaskAddVisibility() {
  const canAddTask = currentView === "list" && Boolean(selectedList);

  if (newTaskInput) {
    newTaskInput.disabled = !canAddTask;
    newTaskInput.placeholder = canAddTask
      ? "New task"
      : "Select a list to add a task";

    if (!canAddTask) {
      newTaskInput.value = "";
    }
  }

  if (addTaskButton) {
    addTaskButton.disabled = !canAddTask;
  }
}

async function loadTasksForView() {
  // Načte úkoly podle aktuálního pohledu (konkrétní seznam nebo rychlý pohled)
  try {
    // Sestaví URL pro načtení úkolů podle aktuálního pohledu
    const viewEndpointMap = {
      list: selectedList ? `/api/todo/lists/${selectedList.id}/tasks` : null,
      all: "/api/todo/alltasks",
      currentDay: "/api/todo/currentday",
      overdue: "/api/todo/overdue",
      important: "/api/todo/important",
      completed: "/api/todo/completed",
    };

    const url = viewEndpointMap[currentView] || null;

    if (!url) {
      return;
    }

    // Nastavení řazení úkolů jako query parametr pro API
    const urlWithSort = `${url}?sort=${encodeURIComponent(currentSort)}`;

    // Načtení úkolů z API
    const response = await fetch(urlWithSort);
    if (!response.ok) throw new Error("Failed to load tasks");
    const tasks = await response.json();

    // Vyčistí zobrazení úkolů a zobrazí načtené úkoly
    taskListContainer.innerHTML = "";
    const todayLocal = toLocalDateString();

    const isQuickView = currentView !== "list";

    tasks.forEach((task) => {
      const div = document.createElement("div");
      div.className = "task-item";
      if (task.is_completed) {
        div.classList.add("completed");
      }

      if (task.is_important) {
        div.classList.add("important");
      }

      const importantButton = document.createElement("button");
      importantButton.className = "task-important";
      importantButton.type = "button";
      importantButton.textContent = task.is_important ? "★" : "☆";
      importantButton.onclick = (event) => {
        event.stopPropagation();
        toggleTaskImportant(task);
      };

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.is_completed;
      checkbox.onchange = () => toggleTask(task);

      const span = document.createElement("span");
      span.className = "task-name";
      span.textContent = task.title;
      div.onclick = () => selectTask(task, div);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "task-delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "✕";
      deleteBtn.onclick = (event) => {
        event.stopPropagation();
        deleteTask(task);
      };

      div.appendChild(importantButton);
      div.appendChild(checkbox);
      div.appendChild(span);

      // V rychlých pohledech zobrazí název seznamu, do kterého úkol patří
      if (isQuickView && task.tasklist_title) {
        const listTitleSpan = document.createElement("span");
        listTitleSpan.className = "task-list-title";
        listTitleSpan.textContent = `List: ${task.tasklist_title}`;
        div.appendChild(listTitleSpan);
      }

      // Zobrazení připomenutí úkolu, pokud je nastaveno
      if (task.remind_at) {
        const reminder = document.createElement("span");
        reminder.className = "task-reminder";
        const localReminder = utcIsoToLocalDateTime(task.remind_at);
        reminder.textContent = localReminder
          ? `Reminder: ${localReminder.replace("T", " ")}`
          : "";
        div.appendChild(reminder);
      }

      // Zobrazení data splnění úkolu, pokud je nastaveno
      if (task.due) {
        const due = document.createElement("span");
        due.className = "task-due";
        if (toLocalDateString(task.due) < todayLocal && !task.is_completed) {
          due.classList.add("overdue");
        }
        due.textContent = `Due: ${toLocalDateString(task.due)}`;
        div.appendChild(due);
      }

      div.appendChild(deleteBtn);
      taskListContainer.appendChild(div);
    });
  } catch (error) {
    showErrorModal("Error loading tasks");
  }
}

// Odstranění seznamu
async function deleteList(list) {
  try {
    const response = await fetch(`/api/todo/lists/${list.id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete list");

    if (selectedList && selectedList.id === list.id) {
      selectedList = null;
      taskListContainer.innerHTML = "";
      clearTaskEditor();
      updateTaskAddVisibility();
    }

    loadTodolists();
  } catch (error) {
    showErrorModal("Error deleting list");
  }
}

// Výběr seznamu úkolů a načtení jeho úkolů
function selectList(list, element) {
  selectedList = list;
  currentView = "list";
  updateQuickViewActive(null);
  updateTaskAddVisibility();
  clearTaskEditor();
  document
    .querySelectorAll(".todolist-item")
    .forEach((el) => el.classList.remove("active"));
  element.classList.add("active");
  loadTasksForView();
}

// Výběr úkolu pro úpravy
function selectTask(task, element) {
  selectedTask = task;
  selectedTaskId = task.id;
  taskTitleInput.value = task.title;
  taskDueInput.value = task.due ? toLocalDateString(task.due) : "";
  taskReminderInput.value = utcIsoToLocalDateTime(task.remind_at);
  updateClearReminderVisibility();
  document
    .querySelectorAll(".task-item")
    .forEach((el) => el.classList.remove("active"));
  if (element) element.classList.add("active");
}

// Přepnutí stavu dokončení úkolu (is_completed)
async function toggleTask(task) {
  try {
    const response = await fetch(`/api/todo/tasks/${task.id}/completed`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_completed: !task.is_completed,
      }),
    });
    if (!response.ok) throw new Error("Failed to update task");
    loadTasksForView();
  } catch (error) {
    showErrorModal("Error updating task");
  }
}

// Přepnutí stavu důležitosti úkolu (is_important)
async function toggleTaskImportant(task) {
  try {
    const response = await fetch(`/api/todo/tasks/${task.id}/important`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_important: !task.is_important,
      }),
    });
    if (!response.ok) throw new Error("Failed to update task importance");
    loadTasksForView();
  } catch (error) {
    showErrorModal("Error updating task importance");
  }
}

// Uložení změn úkolu
saveTaskButton.onclick = async () => {
  if (!selectedTaskId) {
    showErrorModal("Select a task first");
    return;
  }

  const title = taskTitleInput.value.trim();
  if (!title) {
    showErrorModal("Task title is required");
    return;
  }

  const utcRemindAt = localDateTimeToUtcIso(taskReminderInput.value);

  try {
    const response = await fetch(`/api/todo/tasks/${selectedTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        is_completed: Boolean(selectedTask.is_completed),
        due: taskDueInput.value || null,
        remind_at: utcRemindAt,
      }),
    });
    if (!response.ok) throw new Error("Failed to save task");
    loadTasksForView();
  } catch (error) {
    showErrorModal("Error saving task");
  }
};

// Odstranění úkolu
async function deleteTask(task) {
  // Potvrzení smazání úkolu, zatím pouze přes alert
  //if (!confirm("Delete this task?")) return;

  try {
    const response = await fetch(`/api/todo/tasks/${task.id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete task");
    loadTasksForView();

    if (selectedTaskId === task.id) {
      clearTaskEditor();
    }
  } catch (error) {
    showErrorModal("Error deleting task");
  }
}

clearReminderButton.onclick = () => {
  taskReminderInput.value = "";
  updateClearReminderVisibility();
};

deleteSelectedTaskButton.onclick = async () => {
  if (!selectedTask) {
    showErrorModal("Select a task first");
    return;
  }

  await deleteTask(selectedTask);
};

// Přidání nového úkolu
addTaskButton.onclick = async () => {
  if (!selectedList) {
    showErrorModal("Select a list first");
    return;
  }

  const title = newTaskInput.value.trim();
  if (!title) return;

  try {
    const response = await fetch(`/api/todo/lists/${selectedList.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error("Failed to add task");

    newTaskInput.value = "";
    loadTasksForView();
  } catch (error) {
    showErrorModal("Error adding task");
  }
};

// Přidání nového seznamu úkolů
addTasklistButton.onclick = async () => {
  const title = newTasklistInput.value.trim();
  if (!title) return;

  try {
    const response = await fetch("/api/todo/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error("Failed to add list");

    newTasklistInput.value = "";
    loadTodolists();
  } catch (error) {
    showErrorModal("Error adding list");
  }
};

function initTodo() {
  taskReminderInput.addEventListener("input", updateClearReminderVisibility);
  setupQuickViews();
  setupTaskSort();
  loadTodolists();
  updateClearReminderVisibility();
  updateTaskAddVisibility();
}

initTodo();
