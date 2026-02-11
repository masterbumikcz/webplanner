import express from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import passport from "passport";

const router = express.Router();

// Registrace nového uživatele
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Kontrola jestli uživatel s daným emailem již neexistuje
    const existingUser = await db.get(
      "SELECT id FROM users WHERE email = ?",
      email,
    );

    if (existingUser) {
      req.flash("error", "Email already exists. Please use a different email.");
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
