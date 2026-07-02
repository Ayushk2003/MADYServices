import { useEffect, useMemo, useState } from "react";
import { Lock, RefreshCw, ShieldCheck } from "lucide-react";


import { useAuthGate } from "./AuthGate";
import { allowAdminPageEntry, hasAllowedAdminPageEntry, isTestingOwnerEmail, isAdminUser } from "../access";
import { ErrorBoundary } from "../error";
import { LoadingState } from "../loading";
import { supabase } from "../supabaseClient";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  message: string;
  created_at: string;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function AdminFeedback() {
  const { user, isAuthReady, openAuth } = useAuthGate();
  const [hasAdminEntry] = useState(() => hasAllowedAdminPageEntry());

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);

  const isAdmin = isAdminUser(user);

  const fetchFeedback = async () => {
    if (!supabase || !isAdmin) return;

    setStatus("loading");
    setMessage("");

    const { data, error } = await supabase
      .from("feedback_messages")
      .select("id,user_id,email,message,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setFeedback((data || []) as FeedbackRow[]);
    setStatus("idle");
  };

  useEffect(() => {
    if (!isAuthReady) return;
    if (!hasAdminEntry) return;
    if (!user) return;
    if (!isAdmin) {
      setFeedback([]);
      return;
    }

    void fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, hasAdminEntry, isAdmin]);

  const header = useMemo(() => {
    const count = feedback.length;
    return {
      title: "Feedback",
      subtitle: `${count} message${count === 1 ? "" : "s"} received`,
    };
  }, [feedback.length]);

  if (!isAuthReady) {
    return (
      <main>
        <section className="admin-page">
          <LoadingState label="Checking access" detail="Verifying your MADY labs session." />
        </section>
      </main>
    );
  }

  if (!hasAdminEntry) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Restricted staff portal</span>
          <h1>Admin access must start from the site button.</h1>
          <p>Direct URL access to this page is blocked. Use the Admin button in the website header.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/">
              Back home
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <Lock size={34} aria-hidden="true" />
          <span>Admin manager access</span>
          <h1>Login before opening feedback desk.</h1>
          <p>Only MADY labs admins can view feedback messages.</p>
          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => openAuth("login", "open the admin feedback desk")}
            >
              Login
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Admin only</span>
          <h1>This page is only for admins.</h1>
          <p>Managers can view service requests in the Manager portal. Feedback desk is admin-only.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="admin-page">
        <div className="admin-head">
          <div>
            <span>Admin feedback</span>
            <h1>{header.title}</h1>
            <p>{header.subtitle}</p>
          </div>
          <div className="admin-head-actions">
            <button
              className="admin-refresh"
              type="button"
              onClick={() => void fetchFeedback()}
              disabled={status === "loading"}
            >
              <RefreshCw size={17} aria-hidden="true" />
              {status === "loading" ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>

        {message && <p className={`form-message ${status === "error" ? "error" : "idle"}`}>{message}</p>}

        <ErrorBoundary fallbackTitle="Feedback table could not render." variant="inline">
          <div className="admin-profile-table-wrap">
            <table className="admin-profile-table admin-feedback-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {feedback.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "rgba(244, 247, 245, 0.72)" }}>
                      No feedback messages yet.
                    </td>
                  </tr>
                ) : (
                  feedback.map((row) => (
                    <tr key={row.id}>
                      <td>{row.user_id ? row.user_id : "Not provided"}</td>
                      <td>{row.email ? row.email : "Not provided"}</td>
                      <td className="feedback-message-cell">{row.message}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ErrorBoundary>
      </section>
    </main>
  );
}

