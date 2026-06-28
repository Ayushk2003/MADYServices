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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [intent, setIntent] = useState("continue with MADY Media");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ? userFromSession(data.session.user) : null);
      setIsAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? userFromSession(session.user) : null);
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

    const { data, error } =
      mode === "register"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session?.user) {
      setUser(userFromSession(data.session.user));
      setIsOpen(false);
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
