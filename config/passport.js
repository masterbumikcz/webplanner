import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";

// Configurace Passport.js pro autentizaci uživatelů
function configurePassport(passport, pool) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          // Nalezení uživatele v databázi podle emailu a získání jeho ID a zahashovaného hesla
          const userRes = await pool.query(
            "SELECT id, password FROM users WHERE email = $1",
            [email],
          );
          const user = userRes.rows[0];
          if (!user)
            return done(null, false, { message: "No user with that email" });

          // Porovnání zadaného hesla s hashovaným heslem v databázi
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch)
            return done(null, false, { message: "Password incorrect" });

          return done(null, { id: user.id });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // Serializace uživatele - po úspěšném přihlášení se uloží ID uživatele do session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserializace uživatele - při každém požadavku se z session načte ID a
  // načte se z databáze pouze identifikátor (email se v req.user nepoužívá).
  passport.deserializeUser(async (id, done) => {
    try {
      const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [
        id,
      ]);
      done(null, userRes.rows[0] || false);
    } catch (err) {
      done(err);
    }
  });
}

export default configurePassport;
