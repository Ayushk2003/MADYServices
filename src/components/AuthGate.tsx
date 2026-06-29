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
import { allowAdminPageEntry, isTestingOwnerEmail, TESTING_OWNER_EMAIL } from "../access";
import { LoadingButtonLabel } from "../loading";

type AuthMode = "login" | "register";
type AccountRole = "member" | "admin" | "manager";
type AuthAudience = "user" | "admin";

const bootstrapAdminEmails = new Set([TESTING_OWNER_EMAIL]);
const AUTH_PROFILE_TIMEOUT_MS = 8000;

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
  role: "member",
});

const isStrongPassword = (password: string) =>
  password.length >= 8 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const withTimeout = async <T,>(work: Promise<T>, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), AUTH_PROFILE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

const syncProfile = async (nextUser: AppUser) => {
  await supabase?.rpc("sync_profile", {
    profile_id: nextUser.id,
    profile_name: nextUser.name,
    profile_email: nextUser.email,
  });
};

const ensureBootstrapAdminRole = async (nextUser: AppUser) => {
  if (!supabase || !bootstrapAdminEmails.has(nextUser.email.toLowerCase())) {
    return;
  }

  await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", nextUser.id);
};

const hydrateProfileRole = async (nextUser: AppUser): Promise<AppUser> => {
  const { data } =
    (await supabase
      ?.from("profiles")
      .select("name,email,role")
      .eq("id", nextUser.id)
      .maybeSingle()) || {};

  return {
    ...nextUser,
    name: data?.name || nextUser.name,
    email: data?.email || nextUser.email,
    role: bootstrapAdminEmails.has((data?.email || nextUser.email).toLowerCase())
      ? "admin"
      : data?.role === "admin" || data?.role === "manager"
        ? data.role
        : "member",
  };
};

const prepareProfileForAuth = async (nextUser: AppUser) => {
  await withTimeout(
    syncProfile(nextUser).then(() => ensureBootstrapAdminRole(nextUser)),
    "Login worked, but profile sync is taking too long. Apply the latest schema.sql in Supabase, then try again.",
  );

  return withTimeout(
    hydrateProfileRole(nextUser),
    "Login worked, but profile role loading is taking too long. Apply the latest schema.sql in Supabase, then try again.",
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [intent, setIntent] = useState("continue with MADY labs");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState<AccountRole>("member");
  const [selectedAudience, setSelectedAudience] = useState<AuthAudience>("user");

  const isAdminAuthIntent = selectedAudience === "admin";
  const isAdminLoginIntent = mode === "login" && isAdminAuthIntent;

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 4200);
  };

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      const nextUser = data.session?.user ? userFromSession(data.session.user) : null;
      if (nextUser) {
        const hydratedUser = await prepareProfileForAuth(nextUser).catch(() => nextUser);
        if (!isMounted) return;
        setUser(hydratedUser);
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? userFromSession(session.user) : null;
      if (nextUser) {
        void prepareProfileForAuth(nextUser)
          .then(setUser)
          .catch(() => setUser(nextUser));
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const openAuth = (nextMode: AuthMode, nextIntent = "continue with MADY labs") => {
    const isAdminIntent =
      nextIntent.toLowerCase().includes("admin") || window.location.pathname.replace(/\/$/, "") === "/admin";
    setMode(nextMode);
    setIntent(nextIntent);
    setAuthError("");
    setAuthNotice("");
    setSelectedAudience(isAdminIntent ? "admin" : "user");
    setSelectedRole(isAdminIntent ? "admin" : "member");
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
    showToast("Logged out successfully. Taking you home.");
    window.setTimeout(() => {
      window.location.href = "/";
    }, 900);
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

    const { data, error } = await withTimeout(
      mode === "register"
        ? supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name, requested_role: selectedRole },
              emailRedirectTo: window.location.origin,
            },
          })
        : supabase.auth.signInWithPassword({ email, password }),
      "Supabase authentication is taking too long. Check your connection and try again.",
    ).catch((authRequestError) => {
      setAuthError(authRequestError instanceof Error ? authRequestError.message : "Supabase authentication failed.");
      setIsSubmitting(false);
      return { data: null, error: null };
    });

    if (!data && !error) {
      return;
    }

    if (error) {
      const lowerError = error.message.toLowerCase();
      setAuthError(
        lowerError.includes("email rate limit")
          ? "Supabase has temporarily paused confirmation emails for this address. Wait before trying again, or create/confirm this user from the Supabase Auth dashboard."
          : lowerError.includes("email not confirmed")
          ? "Email is registered but not confirmed. Confirm this user in Supabase Authentication > Users, or disable email confirmations while testing."
          : isAdminLoginIntent && lowerError.includes("invalid login")
          ? "Invalid credentials. If this staff email has not been registered yet, use Register inside this admin login popup first."
          : error.message,
      );
      setIsSubmitting(false);
      return;
    }

    if (mode === "register") {
      if (data.user) {
        await withTimeout(
          syncProfile(userFromSession(data.user)),
          "Account was created, but profile sync is taking too long. Login again in a moment.",
        ).catch((profileError) => {
          setAuthNotice(profileError.message);
        });
      }

      event.currentTarget.reset();
      setMode("login");
      setSelectedRole(selectedRole === "member" ? "member" : selectedRole);
      setAuthNotice(
        selectedRole === "member"
          ? "Member created. Please login with the email and password you registered."
          : "Account created. If this email was invited by an admin, login through the admin page with the assigned role.",
      );
      showToast("Account created. Login with your registered details.");
      setIsSubmitting(false);
      return;
    }

    if (data.session?.user) {
      const nextUser = userFromSession(data.session.user);
      let hydratedUser: AppUser;

      try {
        hydratedUser = await prepareProfileForAuth(nextUser);
      } catch (profileError) {
        await supabase.auth.signOut();
        setUser(null);
        setAuthError(profileError instanceof Error ? profileError.message : "Login worked, but profile loading failed.");
        setIsSubmitting(false);
        return;
      }

      if (isAdminLoginIntent && hydratedUser.role !== selectedRole) {
        await supabase.auth.signOut();
        setUser(null);
        setAuthError(
          hydratedUser.role === "member" && bootstrapAdminEmails.has(hydratedUser.email.toLowerCase())
            ? "This email is allowed as admin, but its Supabase profile is still marked member. Apply the latest schema.sql or update this profile role to admin in Supabase."
            : hydratedUser.role === "member"
            ? "This email is registered as a member. Ask an admin to move it to an agency role first."
            : `This email is registered as ${hydratedUser.role}. Select that role to login.`,
        );
        setIsSubmitting(false);
        return;
      }

      setUser(hydratedUser);
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
              {mode === "login" ? "Login to continue." : "Register with MADY labs."}
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
            <div className="auth-audience-toggle" aria-label="Choose account type">
              <button
                type="button"
                className={selectedAudience === "user" ? "is-active" : ""}
                onClick={() => {
                  setSelectedAudience("user");
                  setSelectedRole("member");
                  setIntent("continue with MADY labs");
                }}
              >
                Users
              </button>
              <button
                type="button"
                className={selectedAudience === "admin" ? "is-active" : ""}
                onClick={() => {
                  allowAdminPageEntry();
                  if (window.location.pathname.replace(/\/$/, "") !== "/admin") {
                    setIsOpen(false);
                    window.location.href = "/admin";
                    return;
                  }
                  setSelectedAudience("admin");
                  setSelectedRole("admin");
                  setIntent("open the admin request desk");
                }}
              >
                Admin
              </button>
            </div>
            <form className="auth-form" onSubmit={submitAuth}>
              {isAdminAuthIntent && (
                <div className="role-toggle" aria-label="Agency login role">
                  <span>{mode === "register" ? "Register as" : "Login as"}</span>
                  <button
                    type="button"
                    className={selectedRole === "admin" ? "is-active" : ""}
                    onClick={() => setSelectedRole("admin")}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    className={selectedRole === "manager" ? "is-active" : ""}
                    onClick={() => setSelectedRole("manager")}
                  >
                    Manager
                  </button>
                </div>
              )}
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
                {isSubmitting ? (
                  <LoadingButtonLabel>Working</LoadingButtonLabel>
                ) : (
                  <>
                    {mode === "login" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                    {mode === "login" ? "Login" : "Register"}
                  </>
                )}
              </button>
            </form>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                const nextMode = mode === "login" ? "register" : "login";
                setMode(nextMode);
                setSelectedRole(isAdminAuthIntent ? "admin" : "member");
              }}
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
