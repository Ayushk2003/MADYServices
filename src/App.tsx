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
import { Header, SiteFooter, WhatsAppButton } from "./components/Layout";
import { SceneCanvas } from "./components/SceneCanvas";
import { useScrollReveal } from "./hooks/useScrollReveal";

export function App() {
  useScrollReveal();
  const path = window.location.pathname.replace(/\/$/, "");
  const isHomeRoute = path === "";
  const isCareerRoute = path === "/career";
  const isAdminRoute = path === "/admin";

  return (
    <>
      <SceneCanvas />
      <Header />
      <WhatsAppButton />
      {isAdminRoute ? (
        <AdminRequests />
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
      <SiteFooter />
    </>
  );
}

function FallbackPage() {
  const { requireAuth } = useAuthGate();

  return (
    <main>
      <section className="fallback-page">
        <span>Page not found</span>
        <h1>This MADY Media page is still being built.</h1>
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
