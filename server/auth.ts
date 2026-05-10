import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import type { Express, Request } from "express";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      fullName: string;
      email: string;
      role: string;
    }
  }
}

export function setupAuth(app: Express) {
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  const MStore = MemoryStore(session);
  const sessionStore = new MStore({ checkPeriod: 86400000 });

  app.use(
    session({
      store: sessionStore,
      secret: (() => {
        const s = process.env.SESSION_SECRET;
        if (!s) throw new Error("SESSION_SECRET environment variable is required");
        return s;
      })(),
      resave: false,
      saveUninitialized: false,
      proxy: process.env.NODE_ENV === "production",
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email.toLowerCase().trim());
          if (!user) {
            return done(null, false, { message: "אימייל או סיסמה שגויים" });
          }
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "אימייל או סיסמה שגויים" });
          }
          return done(null, {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    console.log(`[Auth] Login attempt for: ${req.body?.email}`);
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        console.error("[Auth] Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log(`[Auth] Login failed for: ${req.body?.email} - ${info?.message}`);
        return res.status(401).json({ message: info?.message || "אימייל או סיסמה שגויים" });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error("[Auth] Session save error:", err);
          return next(err);
        }
        console.log(`[Auth] Login success for: ${user.email}`);
        res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Session destroy failed" });
        res.clearCookie("connect.sid");
        res.json({ message: "התנתקת בהצלחה" });
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "לא מחובר" });
    }
    res.json({ user: req.user });
  });

  app.post("/api/auth/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "לא מחובר" });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "חובה למלא סיסמה נוכחית וסיסמה חדשה" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "הסיסמה חייבת להיות לפחות 6 תווים" });
    }
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "משתמש לא נמצא" });

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "הסיסמה הנוכחית שגויה" });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(user.id, newHash);
      res.json({ message: "הסיסמה שונתה בהצלחה" });
    } catch (err) {
      res.status(500).json({ message: "שגיאה בשינוי סיסמה" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "חובה להזין אימייל" });
    }
    try {
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.json({ message: "אם האימייל קיים במערכת, קוד איפוס נוצר. פנה למנהל המערכת." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createResetToken(user.id, token, expiresAt);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Password Reset] Token for ${email}: ${token} (expires: ${expiresAt.toISOString()})`);
      }
      res.json({ message: "קוד איפוס נוצר. פנה למנהל המערכת לקבלת הקוד." });
    } catch (err) {
      res.status(500).json({ message: "שגיאה ביצירת קוד איפוס" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "חובה להזין קוד איפוס וסיסמה חדשה" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "הסיסמה חייבת להיות לפחות 6 תווים" });
    }
    try {
      const resetToken = await storage.getValidResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "קוד איפוס לא תקין או שפג תוקפו" });
      }
      const newHash = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(resetToken.userId, newHash);
      await storage.markResetTokenUsed(resetToken.id);
      res.json({ message: "הסיסמה אופסה בהצלחה. ניתן להתחבר עם הסיסמה החדשה." });
    } catch (err) {
      res.status(500).json({ message: "שגיאה באיפוס סיסמה" });
    }
  });

  app.get("/api/auth/validate-reset-token/:token", async (req, res) => {
    try {
      const resetToken = await storage.getValidResetToken(req.params.token);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "קוד איפוס לא תקין או שפג תוקפו" });
      }
      res.json({ valid: true });
    } catch (err) {
      res.status(500).json({ valid: false, message: "שגיאה" });
    }
  });
}

export function requireAuth(req: Request, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "לא מחובר" });
  }
  next();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
