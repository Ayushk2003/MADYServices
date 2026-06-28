import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LogIn, UserPlus, X } from "lucide-react";
import { isSupabaseConfigured, supabase, type AppUser } from "../supabaseClient";

type AuthMode = "login" | "register";

type AuthContextValue = {
  user: AppUser | null;
  isAuthReady: boolean;
  requireAuth: (intent: string) => boolean;
  openAuth: (mode: AuthMode, intent?: string) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const userFromSession = (sessionUser: {
  id: string;
  email?: string;
  user_metadata?: { name?: string; full_name?: string };
}): AppUser => ({
  id: sessionUser.id,
  email: sessionUser.email || "",
  name: sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || "MADY Member",
});

const isStrongPassword = (password: string) =>
  password.length >= 8 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const syncProfile = async (nextUser: AppUser) => {
  await supabase?.from("profiles").upsert({
    id: nextUser.id,
    name: nextUser.name,
    email: nextUser.email,
  });
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [intent, setIntent] = useState("continue with MADY Media");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 4200);
  };

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const nextUser = data.session?.user ? userFromSession(data.session.user) : null;
      setUser(nextUser);
      if (nextUser) {
        void syncProfile(nextUser);
      }
      setIsAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? userFromSession(session.user) : null;
      setUser(nextUser);
      if (nextUser) {
        void syncProfile(nextUser);
      }
      setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const openAuth = (nextMode: AuthMode, nextIntent = "continue with MADY Media") => {
    setMode(nextMode);
    setIntent(nextIntent);
    setAuthError("");
    setAuthNotice("");
    setIsOpen(true);
  };

  const requireAuth = (nextIntent: string) => {
    if (user) {
      return true;
    }
    openAuth("login", nextIntent);
    return false;
  };

  const logout = async () => {
    await supabase?.auth.signOut();
    setUser(null);
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    if (!supabase) {
      setAuthError("Supabase is not configured yet. Add the Vercel environment variables and redeploy.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "MADY Member").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (mode === "register" && !isStrongPassword(password)) {
      setAuthError("Use a stronger password with uppercase, lowercase, number, and symbol.");
      setIsSubmitting(false);
      return;
    }

    const { data, error } =
      mode === "register"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: window.location.origin,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
      setIsSubmitting(false);
      return;
    }

    if (mode === "register") {
      if (data.user) {
        await syncProfile(userFromSession(data.user));
      }

      event.currentTarget.reset();
      setMode("login");
      setAuthNotice("Member created. Please login with the email and password you registered.");
      showToast("Member created. Login with your registered details.");
      setIsSubmitting(false);
      return;
    }

    if (data.session?.user) {
      const nextUser = userFromSession(data.session.user);
      await syncProfile(nextUser);
      setUser(nextUser);
      setIsOpen(false);
      showToast("Login successful.");
    } else {
      setAuthNotice("Check your email to confirm your account, then login.");
    }

    setIsSubmitting(false);
  };

  const value = useMemo(
    () => ({ user, isAuthReady, requireAuth, openAuth, logout }),
    [user, isAuthReady],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toastMessage && (
        <div className="auth-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
      {isOpen && (
        <div className="auth-backdrop" role="presentation">
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button
              className="auth-close"
              type="button"
              aria-label="Close authentication"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <span className="auth-kicker">{mode === "login" ? "Member access" : "Create account"}</span>
            <h2 id="auth-title">
              {mode === "login" ? "Login to continue." : "Register with MADY Media."}
            </h2>
            <p>
              Please {mode === "login" ? "login" : "register"} to {intent}. New users can register
              in this same popup.
            </p>
            {!isSupabaseConfigured && (
              <p className="auth-message error">
                Supabase environment variables are missing, so live auth is not active yet.
              </p>
            )}
            {authError && <p className="auth-message error">{authError}</p>}
            {authNotice && <p className="auth-message success">{authNotice}</p>}
            <form className="auth-form" onSubmit={submitAuth}>
              {mode === "register" && (
                <label>
                  Name
                  <input name="name" type="text" placeholder="Your name" required />
                </label>
              )}
              <label>
                Email
                <input name="email" type="email" placeholder="you@example.com" required />
              </label>
              <label>
                Password
                <input name="password" type="password" placeholder="Password" required />
                {mode === "register" && (
                  <span className="password-note">
                    Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                  </span>
                )}
              </label>
              <button type="submit" disabled={isSubmitting || !isSupabaseConfigured}>
                {mode === "login" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                {isSubmitting ? "Working..." : mode === "login" ? "Login" : "Register"}
              </button>
            </form>
            <button
              className="auth-switch"
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "New here? Register" : "Already a member? Login"}
            </button>
          </section>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuthGate() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthGate must be used inside AuthProvider");
  }
  return context;
}
