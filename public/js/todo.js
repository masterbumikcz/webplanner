// Proměnné pro aktuálně vybraný seznam a úkol
let currentList = null;
let currentTaskId = null;

// Načtení seznamů úkolů po načtení dokumentu
document.addEventListener("DOMContentLoaded", () => {
  loadTodolists();
});

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
  document
    .querySelectorAll(".todolist-item")
    .forEach((el) => el.classList.remove("active"));
  element.classList.add("active");
  loadTasks(list.id);
}

// Načtení úkolů pro vybraný seznam
async function loadTasks(taskListId) {
  try {
    const res = await fetch(`/api/todo/lists/${taskListId}/tasks`);
    const tasks = await res.json();
    const taskContainer = document.querySelector(".tasks-list");
    taskContainer.innerHTML = "";

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

    if (currentList) loadTasks(currentList.id);
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

    loadTasks(currentList.id);
  } catch (err) {
    alert("Error saving task");
  }
};

// Odstranění úkolu
async function deleteTask(task) {
  if (!confirm("Delete this task?")) return;

  try {
    await fetch(`/api/todo/tasks/${task.id}`, { method: "DELETE" });
    alert("Task deleted");
    if (currentList) loadTasks(currentList.id);

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
    loadTasks(currentList.id);
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
