import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import db from "../db.js";
import nodemailer from "nodemailer";
import flash from "express-flash";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();

router.get("/forgot-password", (req, res) => {
  console.log("Received GET request for /forgot-password");
  res.status(200).json({ message: "Forgot password get is working" });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await db.get(
      "SELECT id, email FROM users WHERE email = ?",
      [email],
    );

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

      await db.run("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
      await db.run(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [user.id, tokenHash, expiresAt],
      );

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: user.email,
        subject: "Password reset",
        text: `Use this token to reset your password (valid for 30 minutes): ${token}`,
      };
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
      req.flash("error", "Email not found. Please check your email address.");
      return res.redirect("/forgot-password");
    }
  } catch (error) {
    console.error("Error during password reset process:", error);
    req.flash(
      "error",
      "An error occurred while processing your request. Please try again later.",
    );
    return res.redirect("/forgot-password");
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    req.flash("error", "Token and new password are required.");
    return res.redirect("/forgot-password");
  }

  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const resetRow = await db.get(
      "SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?",
      [tokenHash],
    );

    if (!resetRow || resetRow.used_at) {
      req.flash("error", "Invalid or already used reset token.");
      return res.redirect("/forgot-password");
    }

    if (new Date(resetRow.expires_at) < new Date()) {
      req.flash("error", "Reset token has expired. Please request a new one.");
      return res.redirect("/forgot-password");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.run("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      resetRow.user_id,
    ]);
    await db.run(
      "UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?",
      [tokenHash],
    );

    req.flash("success", "Password reset successful. Please log in.");
    return res.redirect("/login");
  } catch (error) {
    console.error("Error during password reset:", error);
    req.flash(
      "error",
      "An error occurred while resetting your password. Please try again later.",
    );
    return res.redirect("/forgot-password");
  }
});

export default router;
