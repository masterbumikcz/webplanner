// Imports
import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";

// Config
dotenv.config();
const router = express.Router();

// Změna hesla pro přihlášeného uživatele
router.post("/change-password", ensureAuthenticated, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Ověření, že všechny pole jsou vyplněna
  if (!currentPassword || !newPassword || !confirmPassword) {
    req.flash("error", "All fields are required.");
    return res.redirect("/settings");
  }

  // Ověření shody nových hesel
  if (newPassword !== confirmPassword) {
    req.flash("error", "New passwords do not match.");
    return res.redirect("/settings");
  }

  // Ověření délky nového hesla
  if (newPassword.length < 8) {
    req.flash("error", "New password must be at least 8 characters long.");
    return res.redirect("/settings");
  }

  try {
    // Nalezení uživatele v databázi
    const userRes = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [req.user.id],
    );
    const user = userRes.rows[0];

    // Ověření aktuálního hesla
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      req.flash("error", "Current password is incorrect.");
      return res.redirect("/settings");
    }

    // Hashování nového hesla
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Aktualizace hesla v databázi
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      req.user.id,
    ]);

    req.flash("success", "Password changed successfully.");
    res.redirect("/settings");
  } catch (err) {
    console.error("Error changing password:", err);
    req.flash(
      "error",
      "An error occurred while changing the password. Please try again.",
    );
    res.redirect("/settings");
  }
});

// Žádost o smazání účtu pro přihlášeného uživatele
router.post("/request-delete", ensureAuthenticated, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    req.flash("error", "Password is required to request account deletion.");
    return res.redirect("/settings");
  }

  try {
    // Nalezení uživatele v databázi
    const userRes = await pool.query(
      "SELECT email, password FROM users WHERE id = $1",
      [req.user.id],
    );
    const user = userRes.rows[0];

    // Ověření zadaného hesla
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash(
        "error",
        "Password is incorrect. Account deletion request failed.",
      );
      return res.redirect("/settings");
    }

    // Vygenerování tokenu pro potvrzení smazání účtu
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // Token platný 15 minut

    // Smazání starých žádostí o smazání účtu pro tohoto uživatele
    await pool.query("DELETE FROM account_deletions WHERE user_id = $1", [
      req.user.id,
    ]);

    // Uložení nové žádosti o smazání účtu do databáze
    await pool.query(
      "INSERT INTO account_deletions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [req.user.id, tokenHash, expiresAt],
    );

    // Vytvoření transportéru pro odeslání emailu
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Vytvoření emailu s odkazem pro potvrzení smazání účtu
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: user.email,
      subject: "Account deletion request for your Webplanner account",
      text: `You have requested to delete your Webplanner account. Please click the following link to confirm the deletion: ${process.env.BASE_URL}/settings/confirm-delete/${token} \n\nThis link will expire in 15 minutes.`,
    };

    // Odeslání emailu
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent: " + info.response);
      req.flash(
        "success",
        "Account deletion email sent successfully. Please check your inbox.",
      );
      return res.redirect("/settings");
    } catch (error) {
      console.error("Error sending email:", error);
      req.flash(
        "error",
        "Failed to send account deletion email. Please try again later.",
      );
      return res.redirect("/settings");
    }
  } catch (err) {
    console.error("Error processing account deletion request:", err);
    req.flash(
      "error",
      "An error occurred while processing your account deletion request. Please try again.",
    );
    return res.redirect("/settings");
  }
});

// Potvrzení smazání účtu pomocí odkazu s tokenem zaslaného emailem
router.get("/confirm-delete/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const deletionRes = await pool.query(
      "SELECT user_id FROM account_deletions WHERE token_hash = $1 AND expires_at > NOW()",
      [tokenHash],
    );
    const deletion = deletionRes.rows[0];

    // Pokud token není platný nebo vypršel
    if (!deletion) {
      req.flash("error", "Invalid or expired account deletion token.");
      return res.redirect("/login");
    }

    // Smazání uživatele z databáze
    await pool.query("DELETE FROM users WHERE id = $1", [deletion.user_id]);

    // Odhlášení uživatele, pokud je stále přihlášen
    req.logout((error) => {
      if (error) {
        console.error("Error logging out user during account deletion:", error);
      }

      req.flash("success", "Your account has been deleted successfully.");
      return res.redirect("/login");
    });
  } catch (err) {
    console.error("Error confirming account deletion:", err);
    req.flash(
      "error",
      "An error occurred while confirming account deletion. Please try again.",
    );
    return res.redirect("/login");
  }
});

export default router;
