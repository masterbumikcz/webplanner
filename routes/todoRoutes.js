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
    title_asc: `${completedPrefix}lower(title) ASC`,
    title_desc: `${completedPrefix}lower(title) DESC`,
    due_asc: `${completedPrefix}due IS NULL, due ASC, lower(title) ASC`,
    due_desc: `${completedPrefix}due IS NULL, due DESC, lower(title) ASC`,
    created_asc: `${completedPrefix}created_at ASC`,
    created_desc: `${completedPrefix}created_at DESC`,
  };

  // Vrácení odpovídajícího řazení z mapy nebo výchozího řazení, pokud není parametr sort zadán
  return sortMap[sort] || fallbackOrderBy;
}

// Získání všech seznamů úkolů pro přihlášeného uživatele
router.get("/lists", ensureApiAuthenticated, async (req, res) => {
  try {
    const listsRes = await db.query(
      "SELECT id, title FROM task_lists WHERE user_id = $1 ORDER BY title ASC",
      [req.user.id],
    );
    const lists = listsRes.rows;
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
    await db.query("INSERT INTO task_lists (user_id, title) VALUES ($1, $2)", [
      req.user.id,
      title.trim(),
    ]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to create list" });
  }
});

// Smazání seznamu úkolů
router.delete("/lists/:id", ensureApiAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM task_lists WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (result.rowCount === 0) {
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
        "is_completed ASC, due IS NULL, due ASC, lower(title) ASC",
      );

      const listRes = await db.query(
        "SELECT id FROM task_lists WHERE id = $1 AND user_id = $2",
        [req.params.taskListId, req.user.id],
      );
      const list = listRes.rows[0];
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      const tasksRes = await db.query(
        `SELECT id, title, is_completed, due, remind_at
         FROM tasks
         WHERE user_id = $1 AND tasklist_id = $2
         ORDER BY ${orderBy}`,
        [req.user.id, req.params.taskListId],
      );
      res.json(tasksRes.rows);
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
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Task title is required" });
    }
    try {
      const listRes = await db.query(
        "SELECT id FROM task_lists WHERE id = $1 AND user_id = $2",
        [req.params.taskListId, req.user.id],
      );
      const list = listRes.rows[0];
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      await db.query(
        "INSERT INTO tasks (user_id, tasklist_id, title) VALUES ($1, $2, $3)",
        [req.user.id, req.params.taskListId, title.trim()],
      );
      res.status(201).json({ success: true });
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
      "is_completed ASC, due IS NULL, due ASC, lower(title) ASC",
    );

    const tasksRes = await db.query(
      `SELECT id, title, is_completed, due, remind_at, tasklist_id
       FROM tasks
       WHERE user_id = $1
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasksRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Získání úkolů s termínem splnění na aktuální den
router.get("/currentday", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "is_completed ASC, due ASC, lower(title) ASC",
    );

    const tasksRes = await db.query(
      `SELECT id, title, is_completed, due, remind_at, tasklist_id
       FROM tasks
       WHERE user_id = $1 AND due = CURRENT_DATE
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasksRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current day tasks" });
  }
});

// Získání prošlých úkolů (úkoly, které mají nastavené datum splnění, které je v minulosti a úkol není dokončený)
router.get("/overdue", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(req.query.sort, "due ASC, lower(title) ASC");

    const tasksRes = await db.query(
      `SELECT id, title, is_completed, due, remind_at, tasklist_id
       FROM tasks
       WHERE user_id = $1
         AND due IS NOT NULL
         AND due < CURRENT_DATE
         AND is_completed = false
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasksRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch overdue tasks" });
  }
});

// Získání dokončených úkolů
router.get("/completed", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "due IS NULL, due ASC, lower(title) ASC",
    );

    const tasksRes = await db.query(
      `SELECT id, title, is_completed, due, remind_at, tasklist_id
       FROM tasks
       WHERE user_id = $1 AND is_completed = true
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasksRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch completed tasks" });
  }
});

// Změna stavu dokončení úkolu
router.patch("/tasks/:id/completed", ensureApiAuthenticated, async (req, res) => {
  const { is_completed } = req.body;

  const normalizedCompleted =
    is_completed === true || is_completed === "true";

  try {
    const result = await db.query(
      "UPDATE tasks SET is_completed = $1 WHERE id = $2 AND user_id = $3",
      [normalizedCompleted, req.params.id, req.user.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task completion" });
  }
});

// Uložení změn úkolu
router.put("/tasks/:id", ensureApiAuthenticated, async (req, res) => {
  const { title, is_completed, due, remind_at } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Task title is required" });
  }
  try {
    const normalizedReminder = remind_at && remind_at.trim() ? remind_at : null;

    const result = await db.query(
      "UPDATE tasks SET title = $1, is_completed = $2, due = $3, remind_at = $4 WHERE id = $5 AND user_id = $6",
      [
        title.trim(),
        is_completed,
        due || null,
        normalizedReminder,
        req.params.id,
        req.user.id,
      ],
    );
    if (result.rowCount === 0) {
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
    const result = await db.query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
