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
import { useAuthGate } from "./components/AuthGate";
import { Header, PageBackButton, SiteFooter, WhatsAppButton } from "./components/Layout";
import { SceneCanvas } from "./components/SceneCanvas";
import { ErrorBoundary } from "./error";
import { useScrollReveal } from "./hooks/useScrollReveal";

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
