import express from "express";
import db from "../db.js";
import { ensureApiAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

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
      const list = await db.get(
        "SELECT id FROM task_lists WHERE id = ? AND user_id = ?",
        [req.params.taskListId, req.user.id],
      );
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }

      const tasks = await db.all(
        "SELECT id, title, is_completed, due FROM tasks WHERE user_id = ? AND tasklist_id = ?",
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
