import rateLimit from "express-rate-limit";

// Konstanty pro časová okna
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// Vytvoření funkce pro generování limiterů pro formuláře
function createFormLimiter({ windowMs, max, message, redirectTo }) {
  return rateLimit({
    windowMs, // Časové okno pro sledování pokusů
    max, // Maximální počet pokusů
    standardHeaders: "draft-8", // Standard pro hlavičky limitů
    legacyHeaders: false, // Vypnutí starších hlaviček
    message, // Zpráva pro uživatele při překročení limitu
    // Vlastní handler pro přesměrování a zobrazení zprávy pomocí express-flash
    handler: (req, res) => {
      if (typeof req.flash === "function") {
        req.flash("error", message);
      }
      return res.redirect(redirectTo);
    },
  });
}

// Limiter pro přihlašování (nepřihlášený uživatel, zadává email a heslo)
export const loginLimiter = createFormLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  message: "Too many login attempts. Please try again in about 15 minutes.",
  redirectTo: "/login",
});

// Limiter pro zapomenuté heslo (nepřihlášený uživatel, zadává email pro zaslání odkazu)
export const forgotPasswordLimiter = createFormLimiter({
  windowMs: HOUR,
  max: 5,
  message:
    "Too many password reset requests. Please try again in about an hour.",
  redirectTo: "/forgot-password",
});

// Limiter pro žádost o smazání účtu (přihlášený uživatel, zadává heslo pro potvrzení)
export const accountDeleteRequestLimiter = createFormLimiter({
  windowMs: HOUR,
  max: 3,
  message:
    "Too many account deletion requests. Please try again in about an hour.",
  redirectTo: "/settings",
});

// Limiter pro změnu hesla v nastavení (přihlášený uživatel, zadává aktuální a nové heslo)
export const changePasswordLimiter = createFormLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  message:
    "Too many password change attempts. Please try again in about 15 minutes.",
  redirectTo: "/settings",
});
