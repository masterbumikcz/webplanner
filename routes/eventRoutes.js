import express from "express";
import db from "../db.js";
import { ensureApiAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", ensureApiAuthenticated, async (req, res) => {
  // Return all events for the authenticated user
  try {
    const events = await db.all(
      "SELECT id, title, start, end, all_day FROM events WHERE user_id = ? ORDER BY start ASC",
      req.user.id,
    );
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.post("/", ensureApiAuthenticated, async (req, res) => {
  // Create a new event for the authenticated user
  const { title, start, end, all_day } = req.body;
  if (!title || !title.trim() || !start) {
    return res.status(400).json({ error: "Title and start are required" });
  }

  try {
    const result = await db.run(
      "INSERT INTO events (user_id, title, start, end, all_day) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, title.trim(), start, end || null, all_day ? 1 : 0],
    );
    res.json({
      id: result.lastID,
      title: title.trim(),
      start,
      end: end || null,
      all_day: all_day ? 1 : 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.put("/:id", ensureApiAuthenticated, async (req, res) => {
  // Update an existing event (by id) for the authenticated user
  const { title, start, end, all_day } = req.body;
  if (!title || !title.trim() || !start) {
    return res.status(400).json({ error: "Title and start are required" });
  }

  try {
    const result = await db.run(
      "UPDATE events SET title = ?, start = ?, end = ?, all_day = ? WHERE id = ? AND user_id = ?",
      [
        title.trim(),
        start,
        end || null,
        all_day ? 1 : 0,
        req.params.id,
        req.user.id,
      ],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/:id", ensureApiAuthenticated, async (req, res) => {
  // Delete an existing event (by id) for the authenticated user
  try {
    const result = await db.run(
      "DELETE FROM events WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

export default router;
