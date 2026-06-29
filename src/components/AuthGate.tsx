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

type AuthMode = "login" | "register" | "forgot" | "reset";
type AccountRole = "member" | "admin" | "manager";
type AuthAudience = "user" | "admin";
type AgencyAuthLookup = {
  email: string;
  profile_role: AccountRole | null;
  invite_role: Exclude<AccountRole, "member"> | null;
  has_profile: boolean;
  is_agency_email: boolean;
};

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

export const isStrongPassword = (password: string) =>
  password.length >= 8 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const withTimeout = async <T,>(work: PromiseLike<T>, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), AUTH_PROFILE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([Promise.resolve(work), timeout]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getAgencyAuthLookup = async (email: string): Promise<AgencyAuthLookup | null> => {
  if (!supabase) return null;

  const { data, error } = await withTimeout(
    supabase.rpc("agency_auth_lookup", { lookup_email: normalizeEmail(email) }),
    "Staff email check is taking too long. Apply the latest schema.sql in Supabase, then try again.",
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row || null) as AgencyAuthLookup | null;
};

const roleForLookup = (lookup: AgencyAuthLookup | null, email: string) => {
  if (bootstrapAdminEmails.has(normalizeEmail(email))) return "admin";
  return lookup?.profile_role === "admin" || lookup?.profile_role === "manager"
    ? lookup.profile_role
    : lookup?.invite_role || null;
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
      if (_event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setIntent("reset your password");
        setAuthError("");
        setAuthNotice("Enter a new password to finish resetting your account.");
        setSelectedAudience("user");
        setSelectedRole("member");
        setIsOpen(true);
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
    const email = normalizeEmail(String(formData.get("email") || ""));
    const password = String(formData.get("password") || "");
    const newPassword = String(formData.get("new_password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");

    if (mode === "forgot") {
      if (!email) {
        setAuthError("Enter your registered email to receive the reset link.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/profile` }),
        "Password reset email is taking too long. Check your connection and try again.",
      ).catch((resetError) => {
        setAuthError(resetError instanceof Error ? resetError.message : "Password reset email failed.");
        setIsSubmitting(false);
        return { data: null, error: null };
      });

      if (error) {
        setAuthError(error.message);
        setIsSubmitting(false);
        return;
      }

      setAuthNotice("Password reset link sent. Open your email and follow the link to set a new password.");
      showToast("Password reset link sent.");
      setIsSubmitting(false);
      return;
    }

    if (mode === "reset") {
      if (!isStrongPassword(newPassword)) {
        setAuthError("Use a stronger password with uppercase, lowercase, number, and symbol.");
        setIsSubmitting(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setAuthError("New password and confirm password do not match.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        "Password update is taking too long. Check your connection and try again.",
      ).catch((updateError) => {
        setAuthError(updateError instanceof Error ? updateError.message : "Password update failed.");
        setIsSubmitting(false);
        return { data: null, error: null };
      });

      if (error) {
        setAuthError(error.message);
        setIsSubmitting(false);
        return;
      }

      await supabase.auth.signOut();
      setUser(null);
      event.currentTarget.reset();
      setMode("login");
      setAuthNotice("Password updated. Login again with your new password.");
      showToast("Password updated.");
      setIsSubmitting(false);
      return;
    }

    if (mode === "register" && !isStrongPassword(password)) {
      setAuthError("Use a stronger password with uppercase, lowercase, number, and symbol.");
      setIsSubmitting(false);
      return;
    }

    let agencyLookup: AgencyAuthLookup | null = null;
    const selectedAgencyRole = selectedRole === "admin" || selectedRole === "manager" ? selectedRole : null;

    if (isAdminAuthIntent) {
      try {
        agencyLookup = await getAgencyAuthLookup(email);
      } catch (lookupError) {
        setAuthError(lookupError instanceof Error ? lookupError.message : "Staff email check failed.");
        setIsSubmitting(false);
        return;
      }

      const allowedRole = roleForLookup(agencyLookup, email);

      if (!allowedRole) {
        setAuthError("This email is not added as admin or manager. Ask an admin to add this staff email first.");
        setIsSubmitting(false);
        return;
      }

      if (selectedAgencyRole && allowedRole !== selectedAgencyRole) {
        setAuthError(`This email is listed as ${allowedRole}. Select ${allowedRole} to continue.`);
        setIsSubmitting(false);
        return;
      }

      if (mode === "login" && !agencyLookup?.has_profile && !bootstrapAdminEmails.has(email)) {
        setAuthError("This staff email is approved but not registered yet. Use Register inside this popup first.");
        setIsSubmitting(false);
        return;
      }
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
          ? "Invalid credentials."
          : error.message,
      );
      setIsSubmitting(false);
      return;
    }

    if (mode === "register") {
      if (data.session?.user) {
        await prepareProfileForAuth(userFromSession(data.session.user)).catch((profileError) => {
          setAuthNotice(profileError instanceof Error ? profileError.message : "Account was created, but profile sync failed. Login again in a moment.");
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
            <span className="auth-kicker">
              {mode === "login" ? "Member access" : mode === "register" ? "Create account" : mode === "forgot" ? "Password help" : "Reset password"}
            </span>
            <h2 id="auth-title">
              {mode === "login"
                ? "Login to continue."
                : mode === "register"
                  ? "Register with MADY labs."
                  : mode === "forgot"
                    ? "Recover your account."
                    : "Set a new password."}
            </h2>
            <p>
              {mode === "forgot"
                ? "Enter your email and we will send a secure password reset link."
                : mode === "reset"
                  ? "Choose a new password that meets the security rules."
                  : `Please ${mode === "login" ? "login" : "register"} to ${intent}. New users can register in this same popup.`}
            </p>
            {!isSupabaseConfigured && (
              <p className="auth-message error">
                Supabase environment variables are missing, so live auth is not active yet.
              </p>
            )}
            {authError && <p className="auth-message error">{authError}</p>}
            {authNotice && <p className="auth-message success">{authNotice}</p>}
            {mode !== "forgot" && mode !== "reset" && (
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
            )}
            <form className="auth-form" onSubmit={submitAuth}>
              {isAdminAuthIntent && mode !== "forgot" && mode !== "reset" && (
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
              {mode !== "reset" && (
                <label>
                  Email
                  <input name="email" type="email" placeholder="you@example.com" required />
                </label>
              )}
              {mode !== "forgot" && mode !== "reset" && (
                <label>
                  Password
                  <input name="password" type="password" placeholder="Password" required />
                  {mode === "register" && (
                    <span className="password-note">
                      Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                    </span>
                  )}
                </label>
              )}
              {mode === "reset" && (
                <>
                  <label>
                    New password
                    <input name="new_password" type="password" placeholder="New password" required />
                    <span className="password-note">
                      Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                    </span>
                  </label>
                  <label>
                    Confirm password
                    <input name="confirm_password" type="password" placeholder="Confirm new password" required />
                  </label>
                </>
              )}
              {mode === "forgot" && (
                <span className="password-note">
                  The reset link opens MADY again so you can set a new password securely.
                </span>
              )}
              <button type="submit" disabled={isSubmitting || !isSupabaseConfigured}>
                {isSubmitting ? (
                  <LoadingButtonLabel>Working</LoadingButtonLabel>
                ) : (
                  <>
                    {mode === "login" || mode === "forgot" || mode === "reset" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                    {mode === "login" ? "Login" : mode === "register" ? "Register" : mode === "forgot" ? "Send reset link" : "Update password"}
                  </>
                )}
              </button>
            </form>
            <div className="auth-switch-group">
              {mode === "login" && (
                <button className="auth-switch" type="button" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              )}
              <button
                className="auth-switch"
                type="button"
                onClick={() => {
                  const nextMode = mode === "login" ? "register" : "login";
                  setMode(nextMode);
                  setAuthError("");
                  setAuthNotice("");
                  setSelectedRole(isAdminAuthIntent ? "admin" : "member");
                }}
              >
                {mode === "login" ? "New here? Register" : "Already have access? Login"}
              </button>
            </div>
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
