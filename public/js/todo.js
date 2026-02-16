// Proměnné pro aktuálně vybraný seznam a úkol
let currentList = null;
let currentTaskId = null;
let currentView = "list";
let currentSort = "default";
const quickViewAllButton = document.getElementById("quick-view-all");
const quickViewCurrentDayButton = document.getElementById(
  "quick-view-current-day",
);
const quickViewOverdueButton = document.getElementById("quick-view-overdue");
const quickViewCompletedButton = document.getElementById(
  "quick-view-completed",
);
const taskSortSelect = document.getElementById("task-sort");

// Načtení seznamů úkolů po načtení dokumentu
document.addEventListener("DOMContentLoaded", () => {
  setupQuickViews();
  setupTaskSort();
  loadTodolists();
});

function setupTaskSort() {
  if (!taskSortSelect) {
    return;
  }

  taskSortSelect.value = currentSort;
  taskSortSelect.onchange = () => {
    currentSort = taskSortSelect.value || "default";

    if (
      currentView === "all" ||
      currentView === "currentDay" ||
      currentView === "overdue" ||
      currentView === "completed"
    ) {
      loadTasksForView();
      return;
    }

    if (currentList) {
      loadTasksForView(currentList.id);
    }
  };
}

// Načtení seznamů úkolů ze serveru
async function loadTodolists() {
  try {
    const res = await fetch("/api/todo/lists");
    const lists = await res.json();
    const listContainer = document.querySelector(".todolists-list");
    listContainer.innerHTML = "";

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
      listContainer.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading lists:", err);
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

  quickViewCompletedButton.onclick = () => {
    setQuickView("completed");
  };
}

function setQuickView(view) {
  // Přepne do rychlého pohledu a vyčistí výběry
  currentView = view;
  currentList = null;
  currentTaskId = null;
  clearListSelection();
  clearTaskEditor();
  updateQuickViewActive(view);

  if (
    view === "all" ||
    view === "currentDay" ||
    view === "overdue" ||
    view === "completed"
  ) {
    // Načte všechny úkoly napříč seznamy
    loadTasksForView();
  } else {
    // Vyčistí zobrazení úkolů pokud není vybrán žádný pohled
    document.querySelector(".tasks-list").innerHTML = "";
  }
}

function updateQuickViewActive(view) {
  // Zvýrazní aktivní rychlý pohled
  quickViewAllButton.classList.toggle("active", view === "all");
  quickViewCurrentDayButton.classList.toggle("active", view === "currentDay");
  quickViewOverdueButton.classList.toggle("active", view === "overdue");
  quickViewCompletedButton.classList.toggle("active", view === "completed");
}

function clearListSelection() {
  // Zruší aktivní označení seznamu
  document
    .querySelectorAll(".todolist-item")
    .forEach((el) => el.classList.remove("active"));
}

function clearTaskEditor() {
  // Vyčistí editor úkolu
  document.getElementById("task-title").value = "";
  document.getElementById("task-due").value = "";
  document
    .querySelectorAll(".task-item")
    .forEach((el) => el.classList.remove("active"));
}

async function loadTasksForView(taskListId) {
  // Načte úkoly podle aktuálního pohledu (list/all)
  try {
    let url = `/api/todo/lists/${taskListId}/tasks`;
    if (currentView === "all") {
      url = "/api/todo/alltasks";
    } else if (currentView === "currentDay") {
      url = "/api/todo/currentday";
    } else if (currentView === "overdue") {
      url = "/api/todo/overdue";
    } else if (currentView === "completed") {
      url = "/api/todo/completed";
    }
    if (currentSort && currentSort !== "default") {
      url = `${url}?sort=${encodeURIComponent(currentSort)}`;
    }
    const res = await fetch(url);
    const tasks = await res.json();
    const taskContainer = document.querySelector(".tasks-list");
    taskContainer.innerHTML = "";
    const todayLocal = new Date().toISOString().slice(0, 10);

    tasks.forEach((task) => {
      const div = document.createElement("div");
      div.className = "task-item";
      if (task.is_completed) {
        div.classList.add("completed");
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.is_completed;
      checkbox.onchange = () => toggleTask(task);

      const span = document.createElement("span");
      span.className = "task-name";
      span.textContent = task.title;
      div.onclick = () => selectTask(task, div);

      const due = document.createElement("span");
      due.className = "task-due";
      if (task.due && task.due < todayLocal && !task.is_completed) {
        due.classList.add("overdue");
      }
      due.textContent = task.due ? `Due: ${task.due}` : "";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "task-delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "✕";
      deleteBtn.onclick = (event) => {
        event.stopPropagation();
        deleteTask(task);
      };

      div.appendChild(checkbox);
      div.appendChild(span);
      if (task.due) {
        div.appendChild(due);
      }
      div.appendChild(deleteBtn);
      taskContainer.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading tasks:", err);
  }
}

// Odstranění seznamu
async function deleteList(list) {
  try {
    await fetch(`/api/todo/lists/${list.id}`, { method: "DELETE" });

    if (currentList && currentList.id === list.id) {
      currentList = null;
      currentTaskId = null;
      document.querySelector(".tasks-list").innerHTML = "";
      document.getElementById("task-title").value = "";
      document.getElementById("task-due").value = "";
    }

    loadTodolists();
  } catch (err) {
    alert("Error deleting list");
  }
}

// Výběr seznamu úkolů a načtení jeho úkolů
function selectList(list, element) {
  currentList = list;
  currentView = "list";
  updateQuickViewActive(null);
  clearTaskEditor();
  document
    .querySelectorAll(".todolist-item")
    .forEach((el) => el.classList.remove("active"));
  element.classList.add("active");
  loadTasksForView(list.id);
}

// Načtení úkolů pro vybraný seznam

// Výběr úkolu pro úpravy
function selectTask(task, element) {
  currentTaskId = task.id;
  document.getElementById("task-title").value = task.title;
  document.getElementById("task-due").value = task.due || "";
  document
    .querySelectorAll(".task-item")
    .forEach((el) => el.classList.remove("active"));
  if (element) element.classList.add("active");
}

// Přepnutí stavu dokončení úkolu (is_completed)
async function toggleTask(task) {
  try {
    await fetch(`/api/todo/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        is_completed: task.is_completed ? 0 : 1,
        due: task.due || null,
      }),
    });

    if (currentView === "all") {
      loadTasksForView();
    } else if (currentList) {
      loadTasksForView(currentList.id);
    }
  } catch (err) {
    console.error("Error updating task:", err);
  }
}

// Uložení změn úkolu
document.querySelector(".btn-save").onclick = async () => {
  if (!currentTaskId || !currentList) {
    alert("Select a task first");
    return;
  }

  const title = document.getElementById("task-title").value.trim();
  if (!title) {
    alert("Task title is required");
    return;
  }

  try {
    await fetch(`/api/todo/tasks/${currentTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.getElementById("task-title").value,
        is_completed: 0,
        due: document.getElementById("task-due").value,
      }),
    });

    if (currentView === "all") {
      loadTasksForView();
    } else {
      loadTasksForView(currentList.id);
    }
  } catch (err) {
    alert("Error saving task");
  }
};

// Odstranění úkolu
async function deleteTask(task) {
  // Potvrzení smazání úkolu, zatím pouze přes alert
  //if (!confirm("Delete this task?")) return;

  try {
    await fetch(`/api/todo/tasks/${task.id}`, { method: "DELETE" });
    if (currentView === "all") {
      loadTasksForView();
    } else if (currentList) {
      loadTasksForView(currentList.id);
    }

    if (currentTaskId === task.id) {
      currentTaskId = null;
      document.getElementById("task-title").value = "";
      document.getElementById("task-due").value = "";
    }
  } catch (err) {
    alert("Error deleting task");
  }
}

// Přidání nového úkolu
document.getElementById("add-task-btn").onclick = async () => {
  if (!currentList) {
    alert("Select a list first");
    return;
  }

  const input = document.getElementById("task-title-input");
  const title = input.value.trim();
  if (!title) return;

  try {
    await fetch(`/api/todo/lists/${currentList.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, due: null }),
    });

    input.value = "";
    loadTasksForView(currentList.id);
  } catch (err) {
    alert("Error adding task");
  }
};

// Přidání nového seznamu úkolů
document.getElementById("add-tasklist-btn").onclick = async () => {
  const input = document.getElementById("tasklist-title");
  const title = input.value.trim();
  if (!title) return;

  try {
    await fetch("/api/todo/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    input.value = "";
    loadTodolists();
  } catch (err) {
    alert("Error adding list");
  }
};
