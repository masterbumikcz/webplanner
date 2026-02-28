// Imports
import dotenv from "dotenv";
import express from "express";
import flash from "express-flash";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "passport";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import nodemailer from "nodemailer";
import configurePassport from "./config/passport.js";
import pool from "./db.js";
import {
  ensureAuthenticated,
  ensureNotAuthenticated,
} from "./middleware/authMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import passwordRoutes from "./routes/passwordRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

// Config
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 8080;
// Proměnná pro zjištění, zda je aplikace spuštěna v produkčním prostředí (např. Render), nebo lokálně (vývoj)
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PostgresSessionStore = pgSession(session);
app.use(
  session({
    store: new PostgresSessionStore({
      pool: pool,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24,
    }, // 1 den
  }),
);

configurePassport(passport, pool);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Routes
app.use("/auth", authRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/todo", todoRoutes);
app.use("/password", passwordRoutes);
app.use("/settings", settingsRoutes);

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/todo");
  }
  return res.redirect("/login");
});

app.get("/login", ensureNotAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "public", "login.html"));
});

app.get("/register", ensureNotAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "public", "register.html"));
});

app.get("/forgot-password", (req, res) => {
  res.sendFile(join(__dirname, "public", "forgotpassword.html"));
});

app.get("/settings", ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "public", "settings.html"));
});

app.get("/api/messages", (req, res) => {
  const messages = req.flash();
  res.json(messages);
});

app.get("/todo", ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "public", "todo.html"));
});

app.get("/calendar", ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "public", "calendar.html"));
});

// Static files
app.use(express.static("public"));

// Vytvoření trasportéru pro odeslání emailu
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

function formatDueDate(due) {
  if (!due) return "";
  const dateObj = new Date(due);
  const formattedDate = `${dateObj.getUTCDate()}.${dateObj.getUTCMonth() + 1}.${dateObj.getUTCFullYear()}`;
  return formattedDate;
}

// Cron job pro kontrolu úkolů, které mají nastavené připomenutí, a odeslání e-mailu ve chvíli remind_at
cron.schedule("* * * * *", async () => {
  console.log("Running reminder check...");

  try {
    // Získání úkolů, které mají nastavené připomenutí, které je v minulosti nebo právě teď a které nejsou dokončené
    const tasksToNotifyRes = await pool.query(
      `
      SELECT id, user_id, title, due, remind_at
      FROM tasks
      WHERE remind_at IS NOT NULL
        AND remind_at <= NOW()
        AND is_completed = false
      `,
    );
    const tasksToNotify = tasksToNotifyRes.rows;

    // Pro každý úkol, který potřebuje oznámit, získáme email uživatele a odešleme připomenutí
    for (const task of tasksToNotify) {
      console.log(
        `Notifying user ${task.user_id} about task "${task.title}" with reminder at ${task.remind_at}`,
      );

      // Získání uživatele s emailem, kterému patří úkol
      const userRes = await pool.query(
        "SELECT email FROM users WHERE id = $1",
        [task.user_id],
      );
      const user = userRes.rows[0];
      if (user) {
        // Vytvoření emailu s připomenutím
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: user.email,
          subject: "Webplanner task reminder: " + task.title,
          text: `This is a reminder for your task "${task.title}".${task.due ? ` Due date: ${formatDueDate(task.due)}.` : ""}`,
        };
        // Odeslání emailu uživatelovi
        try {
          const info = await transporter.sendMail(mailOptions);
          console.log(`Reminder email sent to ${user.email}: ${info.response}`);
          // Odstranění remind_at z úkolu, aby se připomenutí neodesílalo znovu
          await pool.query("UPDATE tasks SET remind_at = NULL WHERE id = $1", [
            task.id,
          ]);
        } catch (error) {
          console.error(
            `Error sending reminder email to ${user.email}:`,
            error,
          );
        }
      } else {
        console.error(
          `User with ID ${task.user_id} not found for task "${task.title}"`,
        );
      }
    }
  } catch (err) {
    console.error("Error during reminder check:", err);
  }
});

// Start server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  console.log(`Running in ${isProduction ? "production" : "development"} mode`);
});
