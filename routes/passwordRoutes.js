// Imports
import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import db from "../db.js";
import transporter from "../config/transporter.js";
import { forgotPasswordLimiter } from "../middleware/rateLimitMiddleware.js";

// Config
const router = express.Router();

// Vyhledání uživatele podle e-mailu, vytvoření tokenu a odeslání e-mailu s odkazem pro reset hesla
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
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

      // Smazání předchozích tokenů pro daného uživatele
      await db.query("DELETE FROM password_resets WHERE user_id = $1", [
        user.id,
      ]);
      // Uložení hashovaného tokenu s expirací do databáze
      await db.query(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [user.id, tokenHash, expiresAt],
      );

      // Odeslání emailu
      try {
        await transporter.sendMail({
          to: user.email,
          subject: "Password reset for your Webplanner account",
          text: `Click the following link to reset your password: ${process.env.BASE_URL}/password/reset-password/${token} \n\nThis link will expire in 15 minutes.`,
        });
        req.flash(
          "success",
          "Password reset email sent successfully. Please check your inbox.",
        );
        return res.redirect("/forgot-password");
      } catch (error) {
        // Chyba při odesílání emailu
        console.error("Error sending email:", error);
        req.flash(
          "error",
          "Failed to send password reset email. Please try again later.",
        );
        return res.redirect("/forgot-password");
      }
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
    // Hashování tokenu z parametru a vyhledání v databázi
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetRes = await db.query(
      "SELECT expires_at FROM password_resets WHERE token_hash = $1",
      [tokenHash],
    );
    const resetRow = resetRes.rows[0];

    // Kontrola, zda token existuje a není expirovaný
    if (!resetRow || new Date(resetRow.expires_at) < new Date()) {
      req.flash("error", "Invalid or expired reset token.");
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
  // Ověření, zda jsou všechny potřebné údaje k dispozici a validní
  if (typeof token !== "string" || token.trim().length === 0) {
    req.flash("error", "Invalid or missing reset token.");
    return res.redirect("/forgot-password");
  }

  // Odkaz pro přesměrování zpět na formulář pro zadání nového hesla s tokenem v URL
  const resetFormRedirect = `/resetpassword.html?token=${encodeURIComponent(token)}`;

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
    // Hashování tokenu z formuláře a vyhledání v databázi
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetRes = await db.query(
      "SELECT user_id, expires_at FROM password_resets WHERE token_hash = $1",
      [tokenHash],
    );
    const resetRow = resetRes.rows[0];

    // Kontrola, zda token existuje a není expirovaný
    if (!resetRow || new Date(resetRow.expires_at) < new Date()) {
      req.flash("error", "Invalid or expired reset token.");
      return res.redirect("/forgot-password");
    }

    // Hashování nového hesla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Aktualizace hesla pro uživatele
    await db.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      resetRow.user_id,
    ]);
    // Smazání použitého tokenu (vždy vytváříme jen jeden token)
    await db.query("DELETE FROM password_resets WHERE token_hash = $1", [
      tokenHash,
    ]);

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
