import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";

function configurePassport(passport, db) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const userRes = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [email],
          );
          const user = userRes.rows[0];
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
      const userRes = await db.query(
        "SELECT id, email FROM users WHERE id = $1",
        [id],
      );
      done(null, userRes.rows[0] || false);
    } catch (err) {
      done(err);
    }
  });
}

export default configurePassport;
