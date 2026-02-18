import express from "express";
import db from "../db.js";
import { ensureApiAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

// Pomocná funkce pro získání správného řazení úkolů (order by) na základě zadaného parametru sort
function getTaskOrderBy(sort, fallbackOrderBy) {
  // Prefix pro řazení dokončených úkolů vždy na konec, bez ohledu na zvolený způsob řazení
  const completedPrefix = "is_completed ASC, ";

  // Mapování hodnot parametru sort na odpovídající SQL řazení
  const sortMap = {
    title_asc: `${completedPrefix}title COLLATE NOCASE ASC`,
    title_desc: `${completedPrefix}title COLLATE NOCASE DESC`,
    due_asc: `${completedPrefix}due IS NULL, due ASC, title COLLATE NOCASE ASC`,
    due_desc: `${completedPrefix}due IS NULL, due DESC, title COLLATE NOCASE ASC`,
    created_asc: `${completedPrefix}created_at ASC`,
    created_desc: `${completedPrefix}created_at DESC`,
  };

  // Vrácení odpovídajícího řazení z mapy nebo výchozího řazení, pokud není parametr sort zadán
  return sortMap[sort] || fallbackOrderBy;
}

// Získání všech seznamů úkolů pro přihlášeného uživatele
router.get("/lists", ensureApiAuthenticated, async (req, res) => {
  try {
    const lists = await db.all(
      "SELECT id, title FROM task_lists WHERE user_id = ? ORDER BY title ASC",
      req.user.id,
    );
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lists" });
  }
});

// Vytvoření nového seznamu úkolů
router.post("/lists", ensureApiAuthenticated, async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "List name is required" });
  }

  try {
    const result = await db.run(
      "INSERT INTO task_lists (user_id, title) VALUES (?, ?)",
      [req.user.id, title.trim()],
    );
    res.json({ id: result.lastID, title: title.trim() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create list" });
  }
});

// Smazání seznamu úkolů
router.delete("/lists/:id", ensureApiAuthenticated, async (req, res) => {
  try {
    const result = await db.run(
      "DELETE FROM task_lists WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "List not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete list" });
  }
});

// Získání všech úkolů pro daný seznam
router.get(
  "/lists/:taskListId/tasks",
  ensureApiAuthenticated,
  async (req, res) => {
    try {
      const orderBy = getTaskOrderBy(
        req.query.sort,
        // Používám query a ne parametry, protože se jedná o volitelný parametr pro řazení, který může být přítomen nebo ne
        // Zatímco pro ID seznamu používám parametry, protože je povinný a musí být součástí URL
        "is_completed ASC, due IS NULL, due ASC, title COLLATE NOCASE ASC",
      );

      const list = await db.get(
        "SELECT id FROM task_lists WHERE id = ? AND user_id = ?",
        [req.params.taskListId, req.user.id],
      );
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      const tasks = await db.all(
        `SELECT id, title, is_completed, due
         FROM tasks
         WHERE user_id = ? AND tasklist_id = ?
         ORDER BY ${orderBy}`,
        [req.user.id, req.params.taskListId],
      );
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  },
);

// Přidání nového úkolu do seznamu
router.post(
  "/lists/:taskListId/tasks",
  ensureApiAuthenticated,
  async (req, res) => {
    const { title, due } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Task title is required" });
    }
    try {
      const list = await db.get(
        "SELECT id FROM task_lists WHERE id = ? AND user_id = ?",
        [req.params.taskListId, req.user.id],
      );
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      const result = await db.run(
        "INSERT INTO tasks (user_id, tasklist_id, title, is_completed, due) VALUES (?, ?, ?, 0, ?)",
        [req.user.id, req.params.taskListId, title.trim(), due || null],
      );
      res.json({
        id: result.lastID,
        title: title.trim(),
        is_completed: 0,
        due: due || null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to add task" });
    }
  },
);

// Získání všech úkolů pro přihlášeného uživatele (napříč seznamy)
router.get("/alltasks", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "is_completed ASC, due IS NULL, due ASC, title COLLATE NOCASE ASC",
    );

    const tasks = await db.all(
      `SELECT id, title, is_completed, due, tasklist_id
       FROM tasks
       WHERE user_id = ?
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Získání úkolů s termínem splnění na aktuální den
router.get("/currentday", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "is_completed ASC, due ASC, title COLLATE NOCASE ASC",
    );

    const tasks = await db.all(
      `SELECT id, title, is_completed, due, tasklist_id
       FROM tasks
       WHERE user_id = ? AND due = date('now', 'localtime')
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current day tasks" });
  }
});

// Získání prošlých úkolů (úkoly, které mají nastavené datum splnění, které je v minulosti a úkol není dokončený)
router.get("/overdue", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "due ASC, title COLLATE NOCASE ASC",
    );

    const tasks = await db.all(
      `SELECT id, title, is_completed, due, tasklist_id
       FROM tasks
       WHERE user_id = ?
         AND due IS NOT NULL
         AND due < date('now', 'localtime')
         AND is_completed = 0
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch overdue tasks" });
  }
});

// Získání dokončených úkolů
router.get("/completed", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "due IS NULL, due ASC, title COLLATE NOCASE ASC",
    );

    const tasks = await db.all(
      `SELECT id, title, is_completed, due, tasklist_id
       FROM tasks
       WHERE user_id = ? AND is_completed = 1
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch completed tasks" });
  }
});

// Uložení změn úkolu
router.put("/tasks/:id", ensureApiAuthenticated, async (req, res) => {
  const { title, is_completed, due } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Task title is required" });
  }
  try {
    const result = await db.run(
      "UPDATE tasks SET title = ?, is_completed = ?, due = ? WHERE id = ? AND user_id = ?",
      [title.trim(), is_completed, due || null, req.params.id, req.user.id],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Odstranění úkolu
router.delete("/tasks/:id", ensureApiAuthenticated, async (req, res) => {
  try {
    const result = await db.run(
      "DELETE FROM tasks WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
