import { type FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Lock,
  Mail,
  PhoneCall,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  capabilities,
  caseStudies,
  careerExpectations,
  careerReasons,
  onboardingFlow,
  performanceMetrics,
  processSteps,
} from "../data/siteContent";
import { SectionTitle } from "./Layout";
import { SeekChatbot } from "./SeekChatbot";
import { useAuthGate } from "./AuthGate";
import { supabase, type AppUser } from "../supabaseClient";
import { canCreateServiceRequest, canUsePublicUserActions } from "../access";
import { LoadingButtonLabel } from "../loading";
import { usePublicPlacards } from "../hooks/usePlacards";

const REQUEST_LIMIT = 2;

const requestAccessMessage =
  "Only user and admin accounts can send public service requests. Managers can work from the manager portal.";

const requestLimitMessage = "You exceeded your request timeout.";
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const serviceRequestTable = "service_requests";
const askedServiceTable = "asked_services";
const requestTimeoutMs = 12000;

const withRequestTimeout = async <T,>(work: PromiseLike<T>, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), requestTimeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(work), timeout]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

const checkServiceRequestAccess = async (
  user: AppUser,
  requestEmail: string,
  tableName: typeof serviceRequestTable | typeof askedServiceTable,
  setStatus: (status: "idle" | "saving" | "success" | "error") => void,
  setMessage: (message: string) => void,
  onLimit: () => void,
) => {
  setStatus("saving");
  setMessage("Checking access...");

  if (!canCreateServiceRequest(user)) {
    setStatus("error");
    setMessage(requestAccessMessage);
    return false;
  }

  if (!supabase) {
    setStatus("error");
    setMessage("Live request storage is not configured yet.");
    return false;
  }

  let accessResult;

  try {
    accessResult = await withRequestTimeout(
      supabase.from(tableName).select("id", { count: "exact", head: true }).eq("email", normalizeEmail(requestEmail)),
      "Access check timed out. Please try again.",
    );
  } catch (error) {
    setStatus("error");
    setMessage(error instanceof Error ? error.message : "Access check failed. Please try again.");
    return false;
  }

  const { count, error } = accessResult;

  if (error) {
    setStatus("error");
    setMessage(error.message);
    return false;
  }

  if ((count || 0) >= REQUEST_LIMIT) {
    setStatus("idle");
    setMessage("");
    onLimit();
    return false;
  }

  setStatus("idle");
  setMessage("");
  return true;
};

export function Hero() {
  return (
    <section id="top" className="hero scroll-scene">
      <div className="hero-copy reveal-up">
        <p className="kicker">Interactive growth agency for ambitious brands</p>
        <h1>We build websites that feel alive and sell with proof.</h1>
        <p className="hero-lede">
          MADY labs blends 3D web experiences, performance marketing, content systems,
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
      <div className="hero-panel reveal-up" aria-label="MADY labs performance snapshot">
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
  const { user, requireAuth } = useAuthGate();
  const servicePlacards = usePublicPlacards();
  const [selectedService, setSelectedService] = useState("");
  const [serviceNotice, setServiceNotice] = useState("");
  const [serviceToast, setServiceToast] = useState("");

  const showServiceToast = (message: string) => {
    setServiceToast(message);
    window.setTimeout(() => setServiceToast(""), 4000);
  };

  const openServiceRequest = (serviceTitle: string) => {
    setServiceNotice("");

    if (!requireAuth(`request ${serviceTitle}`)) {
      return;
    }

    if (!canCreateServiceRequest(user)) {
      setServiceNotice(requestAccessMessage);
      return;
    }

    setSelectedService(serviceTitle);
  };

  return (
    <section id="services" className="page-section">
      <SectionTitle
        eyebrow="What MADY labs builds"
        title="One agency system across web, media, content, and automation."
        copy="Every component is designed to become reusable: campaign pages, proof blocks, service cards, metric panels, and conversion sections."
      />
      <div className="service-grid">
        {servicePlacards.map((service) => {
          const Icon = service.icon;
          return (
            <article className="service-card reveal-up" key={service.id}>
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
                onClick={() => openServiceRequest(service.title)}
              >
                <Lock size={16} aria-hidden="true" />
                Request service
              </button>
            </article>
          );
        })}
      </div>
      {serviceNotice && <p className="form-message error service-request-notice">{serviceNotice}</p>}
      {serviceToast && (
        <div className="action-toast" role="status" aria-live="polite">
          {serviceToast}
        </div>
      )}
      {user && selectedService && (
        <ServiceRequestModal
          serviceTitle={selectedService}
          onClose={() => setSelectedService("")}
          onSent={() => {
            setSelectedService("");
            showServiceToast("Request sent.");
          }}
          onLimit={() => showServiceToast(requestLimitMessage)}
        />
      )}
    </section>
  );
}

function ServiceRequestModal({
  serviceTitle,
  onClose,
  onSent,
  onLimit,
}: {
  serviceTitle: string;
  onClose: () => void;
  onSent: () => void;
  onLimit: () => void;
}) {
  const { user } = useAuthGate();
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [transcriptRequested, setTranscriptRequested] = useState(true);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [mobileNumber, setMobileNumber] = useState("");

  useEffect(() => {
    if (!supabase || !user) return;

    Promise.resolve(supabase.from("profiles").select("name,email").eq("id", user.id).maybeSingle())
      .then(({ data }) => {
        setProfileName(data?.name || user.name);
        setProfileEmail(data?.email || user.email);
      });
  }, [user]);

  if (!user) return null;

  const submitServiceRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setStatus("error");
      setMessage("Live request storage is not configured yet.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = profileName || user.name;
    const email = normalizeEmail(profileEmail || user.email);
    const mobile = String(formData.get("mobile_number") || "").trim();
    const customerType = String(formData.get("customer_type") || "individual").trim();
    const serviceInfo = String(formData.get("service_info") || "").trim();
    const requirements = String(formData.get("requirements") || "").trim();
    const transcript = [
      `Service: ${serviceTitle}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Mobile: ${mobile}`,
      `Customer Type: ${customerType === "firm" ? "Firm" : "Individual"}`,
      `Service Info: ${serviceInfo}`,
      `Requirements: ${requirements}`,
      `Transcript requested: ${transcriptRequested ? "Yes" : "No"}`,
    ].join("\n");

    if (!(await checkServiceRequestAccess(user, email, serviceRequestTable, setStatus, setMessage, onLimit))) {
      return;
    }

    setStatus("saving");

    let saveResult;

    try {
      saveResult = await withRequestTimeout(
        supabase.from(serviceRequestTable).insert({
        user_id: user.id,
        name,
        email,
        mobile_number: mobile,
        customer_type: customerType,
        project_type: serviceTitle,
        service_title: serviceTitle,
        service_info: serviceInfo,
        requirements,
        message: requirements,
        transcript_requested: transcriptRequested,
        transcript,
        request_source: "service_request",
        }),
        "Request saving timed out. Please try again.",
      );
    } catch (saveError) {
      setStatus("error");
      setMessage(saveError instanceof Error ? saveError.message : "Request saving failed. Please try again.");
      return;
    }

    const { error } = saveResult;

    if (error) {
      if (error.message.toLowerCase().includes("row-level security")) {
        setStatus("idle");
        setMessage("");
        onLimit();
        return;
      }
      setStatus("error");
      setMessage(error.message);
      return;
    }

    onSent();

    if (transcriptRequested) {
      void fetch("/api/send-service-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "Saved in MADY portal",
          userEmail: email,
          userName: name,
          serviceTitle,
          transcript,
        }),
      }).catch((emailError) => {
        console.warn("Request saved, but transcript email failed.", emailError);
      });
    }
  };

  return (
    <div className="service-modal-backdrop" role="presentation">
      <section className="service-modal" role="dialog" aria-modal="true" aria-labelledby="service-request-title">
        <div className="service-modal-header">
          <div>
            <span className="auth-kicker">Service request</span>
            <h2 id="service-request-title">{serviceTitle}</h2>
          </div>
          <button className="service-modal-close" type="button" aria-label="Close service request" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <form className="service-modal-form" onSubmit={submitServiceRequest}>
          <label>
            Name
            <input type="text" value={profileName || user.name} readOnly />
          </label>
          <label>
            Email
            <input name="email" type="email" value={profileEmail || user.email} readOnly required />
          </label>
          <label>
            Mobile number
            <input
              name="mobile_number"
              type="tel"
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
              placeholder="+91 91182 90033"
              required
            />
          </label>
          <label>
            Are you a firm or individual?
            <select name="customer_type" required defaultValue="individual">
              <option value="individual">Individual</option>
              <option value="firm">Firm</option>
            </select>
          </label>
          <label>
            Service info
            <textarea
              name="service_info"
              placeholder="Tell us about your brand, current setup, timeline, and goals."
              required
            />
          </label>
          <label>
            Requirements
            <textarea
              name="requirements"
              placeholder="List must-haves, integrations, pages, budget range, or campaign details."
              required
            />
          </label>
          <div className="transcript-toggle">
            <span>Email transcript copies?</span>
            <button
              type="button"
              className={transcriptRequested ? "is-active" : ""}
              onClick={() => setTranscriptRequested(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={!transcriptRequested ? "is-active" : ""}
              onClick={() => setTranscriptRequested(false)}
            >
              No
            </button>
          </div>
          {message && <p className={`form-message ${status}`}>{message}</p>}
          <button type="submit" disabled={status === "saving"}>
            {status === "saving" ? (
              <LoadingButtonLabel>Saving</LoadingButtonLabel>
            ) : (
              <>
                Send Request
                <Send size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

export function Performance() {
  return (
    <section id="performance" className="page-section performance-band">
      <SectionTitle
        eyebrow="Performance made visible"
        title="Results your clients can understand without a dashboard tour."
        copy="Use these as placeholders now, then swap them with your real case-study numbers as MADY labs work grows."
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
        title="Case-study modules ready for your strongest MADY labs wins."
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
  const [careerNotice, setCareerNotice] = useState("");

  const startCareerSeeking = () => {
    setCareerNotice("");

    if (!requireAuth("meet Seek, the MADY labs AI HR agent")) {
      return;
    }

    if (!canUsePublicUserActions(user)) {
      setCareerNotice("Managers can view this page, but applicant actions are for users and admins.");
    }
  };

  return (
    <section id="career" className="page-section career-section career-page">
      <SectionTitle
        eyebrow="Applicant Portal"
        title="Build your career at MADY labs with AI-supported onboarding."
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
              Hi, I am your MADY labs onboarding guide. I will help you understand the
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
          {user && canUsePublicUserActions(user) ? (
            <SeekChatbot placement="inline" launcherLabel="Meet Seek" scope="career" />
          ) : (
            <button
              className="career-auth-button"
              type="button"
              onClick={startCareerSeeking}
            >
              <Sparkles size={17} aria-hidden="true" />
              Meet Seek
            </button>
          )}
          {careerNotice && <p className="form-message error">{careerNotice}</p>}
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  const { user, requireAuth } = useAuthGate();
  const [formStatus, setFormStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [formMessage, setFormMessage] = useState("");
  const [selectedProject, setSelectedProject] = useState("3D agency website");
  const [briefToast, setBriefToast] = useState("");
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");

  useEffect(() => {
    setProfileName(user?.name || "");
    setProfileEmail(user?.email || "");

    if (!supabase || !user) return;

    const client = supabase;
    const loadProfile = async () => {
      try {
        const { data } = await client.from("profiles").select("name,email").eq("id", user.id).maybeSingle();
        setProfileName(data?.name || user.name);
        setProfileEmail(data?.email || user.email);
      } catch {
        setProfileName(user.name);
        setProfileEmail(user.email);
      }
    };

    void loadProfile();
  }, [user]);

  const showBriefToast = (message: string) => {
    setBriefToast(message);
    window.setTimeout(() => setBriefToast(""), 4000);
  };

  const submitBrief = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage("");

    if (!requireAuth("send a service request")) {
      return;
    }

    if (!supabase || !user) {
      setFormStatus("error");
      setFormMessage("Live request storage is not configured yet.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const projectChoice = String(formData.get("project") || "General request").trim();
    const otherProject = String(formData.get("other_project") || "").trim();
    const projectType = projectChoice === "Other" ? otherProject : projectChoice;
    const name = String(profileName || user.name).trim();
    const email = normalizeEmail(profileEmail || user.email);
    const mobile = String(formData.get("mobile_number") || "").trim();
    const customerType = String(formData.get("customer_type") || "individual").trim();
    const briefMessage = String(formData.get("message") || "").trim();

    if (!(await checkServiceRequestAccess(user, email, askedServiceTable, setFormStatus, setFormMessage, () => showBriefToast(requestLimitMessage)))) {
      return;
    }

    if (projectChoice === "Other" && otherProject.length > 60) {
      setFormStatus("error");
      setFormMessage("Other service must be 60 characters or fewer.");
      return;
    }

    setFormStatus("saving");

    let saveResult;

    try {
      saveResult = await withRequestTimeout(
        supabase.from(askedServiceTable).insert({
          user_id: user.id,
          name,
          email,
          mobile_number: mobile,
          customer_type: customerType,
          project_type: projectType,
          service_title: projectType,
          requirements: briefMessage,
          message: briefMessage,
          request_source: "asked_service",
        }),
        "Brief saving timed out. Please try again.",
      );
    } catch (saveError) {
      setFormStatus("error");
      setFormMessage(saveError instanceof Error ? saveError.message : "Brief saving failed. Please try again.");
      return;
    }

    const { error } = saveResult;

    if (error) {
      if (error.message.toLowerCase().includes("row-level security")) {
        setFormStatus("idle");
        setFormMessage("");
        showBriefToast(requestLimitMessage);
        return;
      }
      setFormStatus("error");
      setFormMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    setSelectedProject("3D agency website");
    setFormStatus("idle");
    setFormMessage("");
    showBriefToast("Brief sent.");
  };

  return (
    <section id="contact" className="contact-section">
      <div className="contact-copy reveal-up">
        <span>Build the MADY labs growth engine</span>
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
      {briefToast && (
        <div className="action-toast" role="status" aria-live="polite">
          {briefToast}
        </div>
      )}
      <form
        className="contact-form reveal-up"
        onSubmit={submitBrief}
      >
        <label>
          Name
          <input type="text" name="name" value={profileName || user?.name || ""} readOnly required />
        </label>
        <label>
          Email
          <input type="email" name="email" value={profileEmail || user?.email || ""} readOnly required />
        </label>
        <label>
          Mobile number
          <input type="tel" name="mobile_number" placeholder="+91 91182 90033" required />
        </label>
        <label>
          Are you a firm or individual?
          <select name="customer_type" required defaultValue="individual">
            <option value="individual">Individual</option>
            <option value="firm">Firm</option>
          </select>
        </label>
        <label>
          Project Type
          <select name="project" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} required>
            <option>3D agency website</option>
            <option>Performance marketing</option>
            <option>Content and creative</option>
            <option>Automation system</option>
            <option>Other</option>
          </select>
        </label>
        {selectedProject === "Other" && (
          <label>
            Other service
            <input type="text" name="other_project" maxLength={60} placeholder="Describe the service" required />
          </label>
        )}
        <label>
          Message
          <textarea name="message" placeholder="What should MADY labs help you grow?" required />
        </label>
        {formMessage && <p className={`form-message ${formStatus}`}>{formMessage}</p>}
        <button type="submit" disabled={formStatus === "saving"}>
          {formStatus === "saving" ? (
            <LoadingButtonLabel>Saving</LoadingButtonLabel>
          ) : (
            <>
              Send Brief
              <Send size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </section>
  );
}
