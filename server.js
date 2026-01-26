// Imports
import dotenv from "dotenv";
import express from "express";
import flash from "express-flash";
import session from "express-session";
import passport from "passport";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import configurePassport from "./config/passport.js";
import db from "./db.js";
import {
  ensureAuthenticated,
  ensureNotAuthenticated,
} from "./middleware/authMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";

// Config
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 8080;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);

configurePassport(passport, db);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Routes
app.use("/auth", authRoutes);
app.use("/api/todo", todoRoutes);

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

// Start server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
