import { type FormEvent, useEffect, useState } from "react";
import {
  Career,
  Contact,
  Hero,
  Performance,
  Process,
  Services,
  Work,
} from "./components/AgencySections";
import { AdminRequests } from "./components/AdminRequests";
import { isStrongPassword, useAuthGate } from "./components/AuthGate";
import { Header, PageBackButton, SiteFooter, WhatsAppButton } from "./components/Layout";
import { SceneCanvas } from "./components/SceneCanvas";
import { ErrorBoundary } from "./error";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { LoadingButtonLabel } from "./loading";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

export function App() {
  useScrollReveal();
  const path = window.location.pathname.replace(/\/$/, "");
  const isHomeRoute = path === "";
  const isCareerRoute = path === "/career";
  const isAdminRoute = path === "/admin";
  const isManagerRoute = path === "/manager";
  const isAcceptedRoute = path === "/accepted";
  const isDeliveredRoute = path === "/delivered";
  const isProfileRoute = path === "/profile";

  return (
    <>
      <SceneCanvas />
      <Header />
      <WhatsAppButton />
      {!isHomeRoute && <PageBackButton />}
      <ErrorBoundary
        key={path || "home"}
        fallbackTitle="This page hit a snag."
        fallbackMessage="The site shell is still available, and you can retry this page without losing the whole experience."
      >
        {isAdminRoute ? (
          <AdminRequests portal="admin" />
        ) : isManagerRoute ? (
          <AdminRequests portal="manager" />
        ) : isAcceptedRoute ? (
          <AdminRequests view="accepted" />
        ) : isDeliveredRoute ? (
          <AdminRequests view="delivered" />
        ) : isProfileRoute ? (
          <ProfilePage />
        ) : isCareerRoute ? (
          <main>
            <Career />
          </main>
        ) : isHomeRoute ? (
          <main>
            <Hero />
            <Services />
            <Performance />
            <Process />
            <Work />
            <Contact />
          </main>
        ) : (
          <FallbackPage />
        )}
      </ErrorBoundary>
      <SiteFooter />
    </>
  );
}

function ProfilePage() {
  const { user, openAuth, logout } = useAuthGate();
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordCheck, setCurrentPasswordCheck] = useState<"idle" | "checking" | "correct" | "incorrect" | "error">("idle");

  useEffect(() => {
    if (!currentPassword) {
      setCurrentPasswordCheck("idle");
      return;
    }

    if (!supabase || !user) {
      setCurrentPasswordCheck("error");
      return;
    }

    const client = supabase;
    setCurrentPasswordCheck("checking");
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      void client.auth
        .signInWithPassword({
          email: user.email,
          password: currentPassword,
        })
        .then(({ error }) => {
          if (!isActive) return;
          setCurrentPasswordCheck(error ? "incorrect" : "correct");
        })
        .catch(() => {
          if (!isActive) return;
          setCurrentPasswordCheck("error");
        });
    }, 650);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [currentPassword, user]);

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage("");

    if (!supabase || !user) {
      setPasswordStatus("error");
      setPasswordMessage("Live auth is not configured yet.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const submittedCurrentPassword = String(formData.get("current_password") || "");
    const newPassword = String(formData.get("new_password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");

    if (!isStrongPassword(newPassword)) {
      setPasswordStatus("error");
      setPasswordMessage("Use a stronger password with uppercase, lowercase, number, and symbol.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordMessage("New password and confirm password do not match.");
      return;
    }

    setPasswordStatus("saving");

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: submittedCurrentPassword,
    });

    if (verifyError) {
      setPasswordStatus("error");
      setPasswordMessage("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setPasswordStatus("error");
      setPasswordMessage(updateError.message);
      return;
    }

    event.currentTarget.reset();
    setCurrentPassword("");
    setCurrentPasswordCheck("idle");
    setPasswordStatus("success");
    setPasswordMessage("Password updated successfully.");
  };

  return (
    <main>
      <section className="profile-page">
        <span>Profile</span>
        <h1>Your MADY labs account.</h1>
        {user ? (
          <div className="profile-panel">
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user.role}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => void logout()}>
              Logout
            </button>
            <form className="profile-password-form" onSubmit={updatePassword}>
              <h2>Update password</h2>
              <label>
                Current password
                <span className="password-check-row">
                  <input
                    name="current_password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      setPasswordMessage("");
                    }}
                    required
                    disabled={!isSupabaseConfigured}
                  />
                  <span className={`password-check ${currentPasswordCheck}`} role="status" aria-live="polite">
                    {currentPasswordCheck === "checking"
                      ? "Checking..."
                      : currentPasswordCheck === "correct"
                        ? "Correct"
                        : currentPasswordCheck === "incorrect"
                          ? "Incorrect"
                          : currentPasswordCheck === "error"
                            ? "Unable to check"
                            : ""}
                  </span>
                </span>
              </label>
              <label>
                New password
                <input name="new_password" type="password" required disabled={!isSupabaseConfigured} />
                <span className="password-note">
                  Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                </span>
              </label>
              <label>
                Confirm new password
                <input name="confirm_password" type="password" required disabled={!isSupabaseConfigured} />
              </label>
              {passwordMessage && <p className={`form-message ${passwordStatus}`}>{passwordMessage}</p>}
              <button type="submit" disabled={passwordStatus === "saving" || currentPasswordCheck !== "correct" || !isSupabaseConfigured}>
                {passwordStatus === "saving" ? <LoadingButtonLabel>Updating</LoadingButtonLabel> : "Update password"}
              </button>
            </form>
          </div>
        ) : (
          <div className="profile-panel">
            <p>Login or register to view your account details.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => openAuth("login")}>
                Login
              </button>
              <button className="ghost-button" type="button" onClick={() => openAuth("register")}>
                Register
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function FallbackPage() {
  const { requireAuth } = useAuthGate();

  return (
    <main>
      <section className="fallback-page">
        <span>Page not found</span>
        <h1>This MADY labs page is still being built.</h1>
        <p>
          Head back to the agency site, explore services, or login before sending a
          new project request.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="/">
            Back home
          </a>
          <a
            className="ghost-button"
            href="/#contact"
            onClick={(event) => {
              if (!requireAuth("send a service request")) {
                event.preventDefault();
              }
            }}
          >
            Start project
          </a>
        </div>
      </section>
    </main>
  );
}
