import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarCheck, ClipboardList, ExternalLink, Video } from "lucide-react";
import {
  Career,
  Contact,
  Feedback,
  Hero,
  Performance,
  Process,
  Services,
  Work,
} from "./components/AgencySections";
import { AdminRequests } from "./components/AdminRequests";
import { AdminFeedback } from "./components/AdminFeedback";
import { isStrongPassword, useAuthGate } from "./components/AuthGate";
import { Header, PageBackButton, RunningHeadline, SiteFooter, WhatsAppButton } from "./components/Layout";
import { PlacardManager } from "./components/PlacardManager";
import { SceneCanvas } from "./components/SceneCanvas";
import { ErrorBoundary } from "./error";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { LoadingButtonLabel, LoadingState } from "./loading";
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
  const isRequestsRoute = path === "/requests";
  const isPlacardsRoute = path === "/placards";
  const isFeedbackRoute = path === "/feedback";

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
        ) : isRequestsRoute ? (
          <UserRequestsPage />
        ) : isPlacardsRoute ? (
          <PlacardManager />
        ) : isFeedbackRoute ? (
          <AdminFeedback />
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
            <Feedback />
          </main>
        ) : (
          <FallbackPage />
        )}
      </ErrorBoundary>
      <SiteFooter />
    </>
  );
}

type UserRequestStatus = "new" | "in_process" | "accepted" | "rejected" | "delivered" | "closed";
type UserRequestSource = "service_request" | "asked_service";

type UserRequest = {
  id: string;
  name: string;
  email: string | null;
  project_type: string;
  service_title: string | null;
  service_info: string | null;
  requirements: string | null;
  message: string;
  request_source: UserRequestSource;
  status: UserRequestStatus;
  decision_note: string | null;
  decision_at: string | null;
  google_meet_link: string | null;
  delivered_at: string | null;
  created_at: string;
};

const userRequestStatusLabel: Record<UserRequestStatus, string> = {
  new: "New",
  in_process: "In process",
  accepted: "Accepted",
  rejected: "Rejected",
  delivered: "Delivered",
  closed: "Closed",
};

const formatRequestDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const canOpenRequestMeet = (request: UserRequest) =>
  (request.status === "accepted" || request.status === "in_process") && Boolean(request.google_meet_link);

const DELIVERED_REQUEST_VISIBLE_MS = 6 * 60 * 60 * 1000;

const isVisibleRequesterRequest = (request: UserRequest, now: number) => {
  if (request.status !== "delivered") return true;
  if (!request.delivered_at) return true;

  return now - new Date(request.delivered_at).getTime() < DELIVERED_REQUEST_VISIBLE_MS;
};

function UserRequestsPage() {
  const { user, openAuth } = useAuthGate();
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const visibleRequests = useMemo(
    () => requests.filter((request) => isVisibleRequesterRequest(request, now)),
    [now, requests],
  );

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setRequests([]);
      return;
    }

    const client = supabase;
    let isActive = true;
    const requestColumns =
      "id,name,email,project_type,service_title,service_info,requirements,message,request_source,status,decision_note,decision_at,google_meet_link,delivered_at,created_at";

    const loadRequests = async () => {
      setStatus("loading");
      setMessage("");

      const [{ data: serviceData, error: serviceError }, { data: askedData, error: askedError }] = await Promise.all([
        client
          .from("service_requests")
          .select(requestColumns)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        client
          .from("asked_services")
          .select(requestColumns)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (!isActive) return;

      if (serviceError || askedError) {
        setStatus("error");
        setMessage([serviceError?.message, askedError?.message].filter(Boolean).join(" "));
        return;
      }

      setRequests(
        ([...((serviceData || []) as UserRequest[]), ...((askedData || []) as UserRequest[])])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
      setStatus("idle");
    };

    void loadRequests();

    return () => {
      isActive = false;
    };
  }, [user]);

  return (
    <main>
      <section className="profile-page requests-page">
        <span>Requests</span>
        <h2>Track your MADY labs requests.</h2>
        <RunningHeadline label="Note :">
          Delivered request cards stay in this requester tab for 6 hours after delivery, then clear automatically.
        </RunningHeadline>
        {!user ? (
          <div className="profile-panel">
            <p>Login to see your submitted service requests and their current status.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => openAuth("login", "track your service requests")}>
                Login
              </button>
            </div>
          </div>
        ) : status === "loading" ? (
          <LoadingState label="Loading requests" detail="Fetching your service request history." variant="inline" />
        ) : (
          <div className="user-request-panel">
            {message && <p className={`form-message ${status}`}>{message}</p>}
            {visibleRequests.length === 0 ? (
              <div className="request-empty-state">
                <ClipboardList size={24} aria-hidden="true" />
                <p>No requests yet. Start from any service card and your submissions will appear here.</p>
              </div>
            ) : (
              visibleRequests.map((request) => (
                <article className="user-request-card" key={`${request.request_source}-${request.id}`}>
                  <div className="user-request-head">
                    <div>
                      <span className={`status-pill ${request.status}`}>{userRequestStatusLabel[request.status]}</span>
                      <h2>{request.service_title || request.project_type}</h2>
                    </div>
                    <time dateTime={request.created_at}>{formatRequestDate(request.created_at)}</time>
                  </div>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>{request.request_source === "asked_service" ? "Asked service" : "Service request"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{userRequestStatusLabel[request.status]}</dd>
                    </div>
                    <div>
                      <dt>Decision at</dt>
                      <dd>{request.decision_at ? formatRequestDate(request.decision_at) : "Pending"}</dd>
                    </div>
                  </dl>
                  {(request.requirements || request.message || request.decision_note) && (
                    <div className="user-request-copy">
                      <p>{request.requirements || request.message}</p>
                      {request.decision_note && (
                        <p>
                          <strong>{request.status === "rejected" ? "Rejection note:" : "Acceptance note:"}</strong>{" "}
                          {request.decision_note}
                        </p>
                      )}
                    </div>
                  )}
                  {canOpenRequestMeet(request) && (
                    <a className="request-meet-link" href={request.google_meet_link || "#"} target="_blank" rel="noreferrer">
                      <Video size={17} aria-hidden="true" />
                      Open Google Meet
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  )}
                  {request.status === "accepted" && !request.google_meet_link && (
                    <span className="request-meet-pending">
                      <CalendarCheck size={16} aria-hidden="true" />
                      Meet link will appear after the company schedules it.
                    </span>
                  )}
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </main>
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
        <h2>Your MADY labs account.</h2>
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
            <button className="logout-action" type="button" onClick={() => void logout()}>
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
