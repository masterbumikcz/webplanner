import express from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import passport from "passport";

const router = express.Router();

// Registrace nového uživatele
router.post("/register", async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  try {
    // Ověření, zda jsou všechny potřebné údaje k dispozici a validní
    if (typeof email !== "string" || email.trim().length === 0) {
      req.flash("error", "Email is required.");
      return res.redirect("/register");
    }

    if (typeof password !== "string" || password.trim().length === 0) {
      req.flash("error", "Password is required.");
      return res.redirect("/register");
    }

    if (
      typeof confirmPassword !== "string" ||
      confirmPassword.trim().length === 0
    ) {
      req.flash("error", "Please confirm your password.");
      return res.redirect("/register");
    }

    // Kontrola jestli uživatel s daným emailem již neexistuje
    const existingUser = await db.get(
      "SELECT id FROM users WHERE email = ?",
      email,
    );

    if (existingUser) {
      req.flash("error", "Email already exists. Please use a different email.");
      return res.redirect("/register");
    }

    // Ověření, zda se zadaná hesla shodují
    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect("/register");
    }

    // Ověření délky hesla
    if (password.length < 8) {
      req.flash("error", "Password must be at least 8 characters long.");
      return res.redirect("/register");
    }

    // Hashování hesla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Vložení nového uživatele se zaheshovaným heslem do databáze
    await db.run(
      `INSERT INTO users (email, password) VALUES (?, ?)`,
      email,
      hashedPassword,
    );

    req.flash("success", "Registration successful! Please login.");
    return res.redirect("/login");
  } catch (err) {
    // Chyba při registraci a přesměrování zpět na registrační stránku s chybovou zprávou
    req.flash("error", "Registration failed. Please try again.");
    return res.redirect("/register");
  }
});

// Přihlášení uživatele
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/todo",
    failureRedirect: "/login",
    failureFlash: true,
  }),
);

// Odhlášení uživatele
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error: ", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    return res.redirect("/login");
  });
});

export default router;
