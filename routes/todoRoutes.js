import express from "express";
import pool from "../db.js";
import { ensureApiAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

// Pomocná funkce pro získání správného SQL řazení podle parametru sort
function getTaskOrderBy(sort, fallbackOrderBy) {
  // Předpona řazení: dokončené úkoly na konec a důležité nahoru
  const priorityPrefix = "t.is_completed ASC, t.is_important DESC, ";

  // Mapování hodnot parametru sort na odpovídající SQL řazení
  const sortMap = {
    title_asc: `${priorityPrefix}lower(t.title) ASC`,
    title_desc: `${priorityPrefix}lower(t.title) DESC`,
    due_asc: `${priorityPrefix}t.due IS NULL, t.due ASC, lower(t.title) ASC`,
    due_desc: `${priorityPrefix}t.due IS NULL, t.due DESC, lower(t.title) ASC`,
    created_asc: `${priorityPrefix}t.created_at ASC`,
    created_desc: `${priorityPrefix}t.created_at DESC`,
  };

  // Vrácení odpovídajícího řazení z mapy nebo výchozího řazení, pokud není parametr sort zadán
  return sortMap[sort] || fallbackOrderBy;
}

// Získání všech seznamů úkolů pro přihlášeného uživatele
router.get("/lists", ensureApiAuthenticated, async (req, res) => {
  try {
    const listsRes = await pool.query(
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
    await pool.query(
      "INSERT INTO task_lists (user_id, title) VALUES ($1, $2)",
      [req.user.id, title.trim()],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to create list" });
  }
});

// Smazání seznamu úkolů
router.delete("/lists/:id", ensureApiAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
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
        "t.is_completed ASC, t.is_important DESC, t.due IS NULL, t.due ASC, lower(t.title) ASC",
      );

      const listRes = await pool.query(
        "SELECT id FROM task_lists WHERE id = $1 AND user_id = $2",
        [req.params.taskListId, req.user.id],
      );
      const list = listRes.rows[0];
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      const tasksRes = await pool.query(
        `SELECT t.id, t.title, t.is_completed, t.is_important, t.due, t.remind_at
         FROM tasks t
         WHERE t.user_id = $1 AND t.tasklist_id = $2
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
      const listRes = await pool.query(
        "SELECT id FROM task_lists WHERE id = $1 AND user_id = $2",
        [req.params.taskListId, req.user.id],
      );
      const list = listRes.rows[0];
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      await pool.query(
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
      "t.is_completed ASC, t.is_important DESC, t.due IS NULL, t.due ASC, lower(t.title) ASC",
    );

    const tasksRes = await pool.query(
      `SELECT t.id, t.title, t.is_completed, t.is_important, t.due, t.remind_at,
              tl.title AS tasklist_title
       FROM tasks t
       JOIN task_lists tl ON tl.id = t.tasklist_id
       WHERE t.user_id = $1
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
      "t.is_completed ASC, t.is_important DESC, t.due ASC, lower(t.title) ASC",
    );

    const tasksRes = await pool.query(
      `SELECT t.id, t.title, t.is_completed, t.is_important, t.due, t.remind_at,
              tl.title AS tasklist_title
       FROM tasks t
       JOIN task_lists tl ON tl.id = t.tasklist_id
       WHERE t.user_id = $1 AND t.due = CURRENT_DATE
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
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "t.is_completed ASC, t.is_important DESC, t.due ASC, lower(t.title) ASC",
    );

    const tasksRes = await pool.query(
      `SELECT t.id, t.title, t.is_completed, t.is_important, t.due, t.remind_at,
              tl.title AS tasklist_title
       FROM tasks t
       JOIN task_lists tl ON tl.id = t.tasklist_id
       WHERE t.user_id = $1
         AND t.due IS NOT NULL
         AND t.due < CURRENT_DATE
         AND t.is_completed = false
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
      "t.is_completed ASC, t.is_important DESC, t.due IS NULL, t.due ASC, lower(t.title) ASC",
    );

    const tasksRes = await pool.query(
      `SELECT t.id, t.title, t.is_completed, t.is_important, t.due, t.remind_at,
              tl.title AS tasklist_title
       FROM tasks t
       JOIN task_lists tl ON tl.id = t.tasklist_id
       WHERE t.user_id = $1 AND t.is_completed = true
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasksRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch completed tasks" });
  }
});

// Získání důležitých úkolů
router.get("/important", ensureApiAuthenticated, async (req, res) => {
  try {
    const orderBy = getTaskOrderBy(
      req.query.sort,
      "t.is_completed ASC, t.due IS NULL, t.due ASC, lower(t.title) ASC",
    );

    const tasksRes = await pool.query(
      `SELECT t.id, t.title, t.is_completed, t.is_important, t.due, t.remind_at,
              tl.title AS tasklist_title
       FROM tasks t
       JOIN task_lists tl ON tl.id = t.tasklist_id
       WHERE t.user_id = $1 AND t.is_important = true
       ORDER BY ${orderBy}`,
      [req.user.id],
    );
    res.json(tasksRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch important tasks" });
  }
});

// Změna stavu dokončení úkolu
router.patch(
  "/tasks/:id/completed",
  ensureApiAuthenticated,
  async (req, res) => {
    const { is_completed } = req.body;

    if (typeof is_completed !== "boolean") {
      return res.status(400).json({ error: "is_completed must be a boolean" });
    }

    try {
      const result = await pool.query(
        "UPDATE tasks SET is_completed = $1 WHERE id = $2 AND user_id = $3",
        [is_completed, req.params.id, req.user.id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update task completion" });
    }
  },
);

// Změna stavu důležitosti úkolu
router.patch(
  "/tasks/:id/important",
  ensureApiAuthenticated,
  async (req, res) => {
    const { is_important } = req.body;

    if (typeof is_important !== "boolean") {
      return res.status(400).json({ error: "is_important must be a boolean" });
    }

    try {
      const result = await pool.query(
        "UPDATE tasks SET is_important = $1 WHERE id = $2 AND user_id = $3",
        [is_important, req.params.id, req.user.id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update task importance" });
    }
  },
);

// Uložení změn úkolu
router.put("/tasks/:id", ensureApiAuthenticated, async (req, res) => {
  const { title, is_completed, due, remind_at } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Task title is required" });
  }
  try {
    const normalizedReminder = remind_at && remind_at.trim() ? remind_at : null;

    const result = await pool.query(
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
    const result = await pool.query(
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
