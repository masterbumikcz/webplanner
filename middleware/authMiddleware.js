// Middlewary pro ověřování a redirekce pro authentikované nebo neauthentikované uživatele

// Kontrola, zda je uživatel přihlášen, pokud není, je přesměrován na přihlašovací stránku
export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.redirect("/login");
}

// Kontrola, zda uživatel není přihlášen, pokud je, je přesměrován na stránku todo
export function ensureNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  return res.redirect("/todo");
}

// Kontrola pro API routy, zda je uživatel přihlášen, pokud není, vrací 401 Unauthorized
export function ensureApiAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}
