import express from "express";
import db from "../db.js";
import { ensureApiAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

// Získání všech událostí
router.get("/", ensureApiAuthenticated, async (req, res) => {
  try {
    const eventsRes = await db.query(
      "SELECT id, title, start_at AS start, end_at AS end, all_day FROM events WHERE user_id = $1 ORDER BY start_at ASC",
      [req.user.id],
    );
    const events = eventsRes.rows;
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Vytvoření nové události
router.post("/", ensureApiAuthenticated, async (req, res) => {
  const { title, start, end, all_day } = req.body;
  if (!title || !title.trim() || !start) {
    return res.status(400).json({ error: "Title and start are required" });
  }

  try {
    const result = await db.query(
      "INSERT INTO events (user_id, title, start_at, end_at, all_day) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [req.user.id, title.trim(), start, end || null, Boolean(all_day)],
    );
    res.json({
      id: result.rows[0]?.id,
      title: title.trim(),
      start,
      end: end || null,
      all_day: Boolean(all_day),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create event" });
  }
});

// Aktualizace existující události
router.put("/:id", ensureApiAuthenticated, async (req, res) => {
  const { title, start, end, all_day } = req.body;
  if (!title || !title.trim() || !start) {
    return res.status(400).json({ error: "Title and start are required" });
  }

  try {
    const result = await db.query(
      "UPDATE events SET title = $1, start_at = $2, end_at = $3, all_day = $4 WHERE id = $5 AND user_id = $6",
      [
        title.trim(),
        start,
        end || null,
        all_day ? 1 : 0,
        req.params.id,
        req.user.id,
      ],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

// Odstranění události
router.delete("/:id", ensureApiAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM events WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

export default router;
