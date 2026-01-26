import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";

function configurePassport(passport, db) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await db.get(
            "SELECT * FROM users WHERE email = ?",
            email,
          );
          if (!user)
            return done(null, false, { message: "No user with that email" });

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch)
            return done(null, false, { message: "Password incorrect" });

          return done(null, { id: user.id, email: user.email });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.get("SELECT id, email FROM users WHERE id = ?", id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });
}

export default configurePassport;
