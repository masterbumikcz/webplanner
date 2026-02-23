// Imports
import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import db from "../db.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Config
const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vyhledání uživatele podle e-mailu, vytvoření tokenu a odeslání e-mailu s odkazem pro reset hesla
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Vyhledání uživatele podle e-mailu
    const userRes = await db.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email],
    );
    const user = userRes.rows[0];

    if (user) {
      // Vytvoření tokenu pro reset hesla
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      // Nastavení expirace tokenu (15 minut)
      const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();

      // Smazání předchozích tokenů pro daného uživatele a uložení nového tokenu do databáze (uložen je jako hash)
      await db.query("DELETE FROM password_resets WHERE user_id = $1", [
        user.id,
      ]);
      await db.query(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [user.id, tokenHash, expiresAt],
      );

      // Vytvoření trasportéru pro odeslání emailu
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      // Vytvoření emailu s odkazem pro reset hesla
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: user.email,
        subject: "Password reset for your Webplanner account",
        text: `Click the following link to reset your password: http://localhost:8080/password/reset-password/${token} \n\nThis link will expire in 15 minutes.`,
      };

      // Odeslání emailu
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          req.flash(
            "error",
            "Failed to send password reset email. Please try again later.",
          );
          return res.redirect("/forgot-password");
        } else {
          console.log("Email sent: " + info.response);
          req.flash(
            "success",
            "Password reset email sent successfully. Please check your inbox.",
          );
          return res.redirect("/forgot-password");
        }
      });
    } else {
      // Zobrazení chybové zprávy pokud e-mail nebyl nalezen
      req.flash("error", "Email not found. Please check your email address.");
      return res.redirect("/forgot-password");
    }
  } catch (error) {
    // Chyba během procesu resetování hesla
    console.error("Error during password reset process:", error);
    req.flash(
      "error",
      "An error occurred while processing your request. Please try again later.",
    );
    return res.redirect("/forgot-password");
  }
});

// Ověření tokenu a zobrazení stránky pro zadání nového hesla
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  try {
    // Hash tokenu pro porovnání s uloženým hashem v databázi
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Vyhledání záznamu pro reset hesla podle hashe tokenu
    const resetRes = await db.query(
      "SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1",
      [tokenHash],
    );
    const resetRow = resetRes.rows[0];

    // Ověření, zda token existuje nebo již nebyl použit
    if (!resetRow || resetRow.used_at) {
      req.flash("error", "Invalid or already used reset token.");
      return res.redirect("/forgot-password");
    }

    // Ověření, zda token nevypršel
    if (new Date(resetRow.expires_at) < new Date()) {
      req.flash("error", "Reset token has expired. Please request a new one.");
      return res.redirect("/forgot-password");
    }

    // Zobrazení stránky pro zadání nového hesla s tokenem v URL
    return res.redirect(
      `/resetpassword.html?token=${encodeURIComponent(token)}`,
    );
  } catch (error) {
    // Chyba během ověřování tokenu
    console.error("Error loading reset token:", error);
    req.flash(
      "error",
      "An error occurred while verifying your reset link. Please try again.",
    );
    return res.redirect("/forgot-password");
  }
});

// Zpracování formuláře pro zadání nového hesla, ověření tokenu a aktualizace hesla v databázi
router.post("/reset-password", async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  // Vytvoření odkazu pro přesměrování zpět na formulář pro zadání nového hesla s tokenem v URL, pokud došlo k chybě
  const resetFormRedirect = token
    ? `/resetpassword.html?token=${encodeURIComponent(token)}`
    : // Pokud token není k dispozici, odkaz přesměruje na stránku pro zadání e-mailu pro reset hesla
      "/forgot-password";

  // Ověření, zda jsou všechny potřebné údaje k dispozici a validní
  if (typeof token !== "string" || token.trim().length === 0) {
    req.flash("error", "Token is required.");
    return res.redirect("/forgot-password");
  }

  if (typeof password !== "string" || password.trim().length === 0) {
    req.flash("error", "Password is required.");
    return res.redirect(resetFormRedirect);
  }

  if (
    typeof confirmPassword !== "string" ||
    confirmPassword.trim().length === 0
  ) {
    req.flash("error", "Please confirm your password.");
    return res.redirect(resetFormRedirect);
  }

  // Ověření, zda se zadaná hesla shodují
  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match.");
    return res.redirect(resetFormRedirect);
  }

  // Ověření délky hesla
  if (password.length < 8) {
    req.flash("error", "Password must be at least 8 characters long.");
    return res.redirect(resetFormRedirect);
  }

  // Pokus o aktualizaci hesla pro uživatele spojeného s tokenem
  try {
    // Hash tokenu pro porovnání s uloženým hashem v databázi
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Vyhledání záznamu pro reset hesla podle hashe tokenu
    const resetRes = await db.query(
      "SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1",
      [tokenHash],
    );
    const resetRow = resetRes.rows[0];

    // Ověření, zda token existuje nebo již nebyl použit
    if (!resetRow || resetRow.used_at) {
      req.flash("error", "Invalid or already used reset token.");
      return res.redirect("/forgot-password");
    }

    // Ověření, zda token nevypršel
    if (new Date(resetRow.expires_at) < new Date()) {
      req.flash("error", "Reset token has expired. Please request a new one.");
      return res.redirect("/forgot-password");
    }

    // Hashování nového hesla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Aktualizace hesla pro uživatele
    await db.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      resetRow.user_id,
    ]);
    // Označení tokenu jako použitého
    await db.query(
      "UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1",
      [tokenHash],
    );

    req.flash("success", "Password reset successful. Please log in.");
    return res.redirect("/login");
  } catch (error) {
    // Chyba během aktualizace hesla
    console.error("Error during password reset:", error);
    req.flash(
      "error",
      "An error occurred while resetting your password. Please try again later.",
    );
    return res.redirect("/forgot-password");
  }
});

export default router;
