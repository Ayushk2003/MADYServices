import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { LogIn, UserPlus, X } from "lucide-react";

type AuthMode = "login" | "register";

type AuthUser = {
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  requireAuth: (intent: string) => boolean;
  openAuth: (mode: AuthMode, intent?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem("mady-auth-user");
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [intent, setIntent] = useState("continue with MADY Media");

  const openAuth = (nextMode: AuthMode, nextIntent = "continue with MADY Media") => {
    setMode(nextMode);
    setIntent(nextIntent);
    setIsOpen(true);
  };

  const requireAuth = (nextIntent: string) => {
    if (user) {
      return true;
    }
    openAuth("login", nextIntent);
    return false;
  };

  const logout = () => {
    localStorage.removeItem("mady-auth-user");
    setUser(null);
  };

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextUser = {
      name: String(formData.get("name") || "MADY Member"),
      email: String(formData.get("email") || "member@madymedia.agency"),
    };
    localStorage.setItem("mady-auth-user", JSON.stringify(nextUser));
    setUser(nextUser);
    setIsOpen(false);
  };

  const value = useMemo(
    () => ({ user, requireAuth, openAuth, logout }),
    [user],
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
              <button type="submit">
                {mode === "login" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                {mode === "login" ? "Login" : "Register"}
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
