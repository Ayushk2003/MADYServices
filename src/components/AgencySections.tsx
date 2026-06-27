import { ArrowRight, Bot, CheckCircle2, Lock, Mail, PhoneCall, Send, Sparkles } from "lucide-react";
import {
  capabilities,
  careerExpectations,
  careerReasons,
  caseStudies,
  onboardingFlow,
  performanceMetrics,
  processSteps,
  services,
} from "../data/siteContent";
import { SectionTitle } from "./Layout";
import { SeekChatbot } from "./SeekChatbot";
import { useAuthGate } from "./AuthGate";

export function Hero() {
  return (
    <section id="top" className="hero scroll-scene">
      <div className="hero-copy reveal-up">
        <p className="kicker">Interactive growth agency for ambitious brands</p>
        <h1>We build websites that feel alive and sell with proof.</h1>
        <p className="hero-lede">
          MADY Media blends 3D web experiences, performance marketing, content systems,
          and automation into one growth machine for your agency clients.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#services">
            Explore Services
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="ghost-button" href="#performance">
            View Results
          </a>
        </div>
      </div>
      <div className="hero-panel reveal-up" aria-label="MADY Media performance snapshot">
        <div>
          <span>Live funnel signal</span>
          <strong>Lead Quality +42%</strong>
        </div>
        <div className="signal-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
  );
}

export function Services() {
  const { requireAuth } = useAuthGate();

  return (
    <section id="services" className="page-section">
      <SectionTitle
        eyebrow="What MADY Media builds"
        title="One agency system across web, media, content, and automation."
        copy="Every component is designed to become reusable: campaign pages, proof blocks, service cards, metric panels, and conversion sections."
      />
      <div className="service-grid">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <article className="service-card reveal-up" key={service.title}>
              <div className="card-topline">
                <Icon size={24} aria-hidden="true" />
                <span>{service.eyebrow}</span>
              </div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <ul>
                {service.points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <button
                className="service-request"
                type="button"
                onClick={() => requireAuth(`request ${service.title}`)}
              >
                <Lock size={16} aria-hidden="true" />
                Request service
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Performance() {
  return (
    <section id="performance" className="page-section performance-band">
      <SectionTitle
        eyebrow="Performance made visible"
        title="Results your clients can understand without a dashboard tour."
        copy="Use these as placeholders now, then swap them with your real case-study numbers as MADY Media work grows."
      />
      <div className="metric-grid">
        {performanceMetrics.map((metric) => (
          <article className="metric-card reveal-up" key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
            <p>{metric.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Process() {
  return (
    <section id="process" className="page-section process-section">
      <SectionTitle
        eyebrow="How the engagement moves"
        title="A tight sprint model from strategy to optimization."
        copy="The scroll journey reveals details in stages, matching how a real agency project matures from market signal to measurable growth."
      />
      <div className="process-rail">
        {processSteps.map((item) => (
          <article className="process-step reveal-up" key={item.step}>
            <span>{item.step}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Work() {
  return (
    <section id="work" className="page-section">
      <SectionTitle
        eyebrow="Proof library"
        title="Case-study modules ready for your strongest MADY Media wins."
        copy="These reusable cards let the agency site scale from launch concept to a deep portfolio without redesigning the whole page."
      />
      <div className="case-grid">
        {caseStudies.map((study) => (
          <article className="case-card reveal-up" key={study.brand}>
            <span>{study.category}</span>
            <h3>{study.brand}</h3>
            <strong>{study.result}</strong>
            <p>{study.description}</p>
          </article>
        ))}
      </div>
      <div className="capability-strip reveal-up">
        {capabilities.map((capability) => {
          const Icon = capability.icon;
          return (
            <span key={capability.label}>
              <Icon size={16} aria-hidden="true" />
              {capability.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}

export function Career() {
  const { user, requireAuth } = useAuthGate();

  return (
    <section id="career" className="page-section career-section career-page">
      <SectionTitle
        eyebrow="Applicant Portal"
        title="Build your career at MADY Media with AI-supported onboarding."
        copy="This page is only for applicants. Business visitors can stay on the main agency site, while candidates get a focused hiring path, role expectations, and an AI HR guide for onboarding."
      />
      <div className="career-layout">
        <div className="career-reasons">
          {careerReasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <article className="career-card reveal-up" key={reason.title}>
                <Icon size={24} aria-hidden="true" />
                <h3>{reason.title}</h3>
                <p>{reason.description}</p>
              </article>
            );
          })}
        </div>
        <aside className="ai-hr-panel reveal-up" aria-label="AI HR onboarding assistant">
          <div className="ai-panel-head">
            <span>
              <Bot size={18} aria-hidden="true" />
              AI HR Agent
            </span>
            <strong>Onboarding active</strong>
          </div>
          <div className="ai-chat">
            <p>
              <Sparkles size={16} aria-hidden="true" />
              Hi, I am your MADY Media onboarding guide. I will help you understand the
              role, tools, team rituals, first tasks, and what success looks like.
            </p>
            <ul>
              {onboardingFlow.map((step) => (
                <li key={step.label}>
                  <span>{step.label}</span>
                  {step.detail}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <div className="expectation-list reveal-up">
        {careerExpectations.map((expectation) => (
          <span key={expectation}>
            <CheckCircle2 size={17} aria-hidden="true" />
            {expectation}
          </span>
        ))}
      </div>
      <div className="applicant-zone reveal-up">
        <div className="applicant-copy">
          <span>Apply through HR</span>
          <h3>Send your profile into the applicant pipeline.</h3>
          <p>
            The AI HR agent can pre-screen your role interest, explain the next steps,
            and prepare your onboarding checklist before a human interview.
          </p>
        </div>
        <div className="applicant-form applicant-seek">
          {user ? (
            <SeekChatbot placement="inline" launcherLabel="Start Seeking" scope="career" />
          ) : (
            <button
              className="career-auth-button"
              type="button"
              onClick={() => requireAuth("start seeking with the AI HR onboarding agent")}
            >
              <Lock size={17} aria-hidden="true" />
              Start Seeking
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  const { requireAuth } = useAuthGate();

  return (
    <section id="contact" className="contact-section">
      <div className="contact-copy reveal-up">
        <span>Build the MADY Media growth engine</span>
        <h2>Tell us the service you want to dominate next.</h2>
        <p>
          Launch with the core agency story today, then connect this form to your
          CRM, WhatsApp, or booking system when you are ready to go live.
        </p>
        <div className="contact-links">
          <a href="mailto:hello@madymedia.agency">
            <Mail size={18} aria-hidden="true" />
            hello@madymedia.agency
          </a>
          <a href="tel:+919118290033">
            <PhoneCall size={18} aria-hidden="true" />
            +91 91182 90033
          </a>
        </div>
      </div>
      <form
        className="contact-form reveal-up"
        onSubmit={(event) => {
          event.preventDefault();
          requireAuth("send a service request");
        }}
      >
        <label>
          Name
          <input type="text" name="name" placeholder="Your name" />
        </label>
        <label>
          Project Type
          <select name="project">
            <option>3D agency website</option>
            <option>Performance marketing</option>
            <option>Content and creative</option>
            <option>Automation system</option>
          </select>
        </label>
        <label>
          Message
          <textarea name="message" placeholder="What should MADY Media help you grow?" />
        </label>
        <button type="submit">
          Send Brief
          <Send size={17} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
