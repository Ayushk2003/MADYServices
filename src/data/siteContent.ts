import {
  BarChart3,
  Blocks,
  Bot,
  Clapperboard,
  Gauge,
  Globe2,
  GraduationCap,
  Handshake,
  LineChart,
  Megaphone,
  MousePointer2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Service = {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  points: string[];
};

export type ServiceIconKey =
  | "website"
  | "marketing"
  | "content"
  | "automation"
  | "ai"
  | "seo"
  | "analytics"
  | "brand";

export type ServicePlacard = Service & {
  id: string;
  icon_key: ServiceIconKey;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type Metric = {
  value: string;
  label: string;
  detail: string;
};

export type CaseStudy = {
  brand: string;
  category: string;
  result: string;
  description: string;
};

export type ProcessStep = {
  step: string;
  title: string;
  description: string;
};

export type CareerPoint = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const navItems = ["Services", "Performance", "Process", "Work", "Career", "Contact"];

export const serviceIconMap: Record<ServiceIconKey, LucideIcon> = {
  website: Globe2,
  marketing: Megaphone,
  content: Clapperboard,
  automation: Workflow,
  ai: Bot,
  seo: Search,
  analytics: LineChart,
  brand: Blocks,
};

export const serviceIconOptions: { key: ServiceIconKey; label: string }[] = [
  { key: "website", label: "Website" },
  { key: "marketing", label: "Marketing" },
  { key: "content", label: "Content" },
  { key: "automation", label: "Automation" },
  { key: "ai", label: "AI" },
  { key: "seo", label: "SEO" },
  { key: "analytics", label: "Analytics" },
  { key: "brand", label: "Brand" },
];

export const services: Service[] = [
  {
    title: "Website Experiences",
    eyebrow: "3D + motion",
    description:
      "Interactive landing pages, campaign sites, and conversion funnels with cinematic motion and responsive performance.",
    icon: Globe2,
    points: ["3D hero systems", "Scroll-led storytelling", "Conversion-first UX"],
  },
  {
    title: "Performance Marketing",
    eyebrow: "growth engine",
    description:
      "Paid media systems that align creative testing, landing page experiments, and revenue reporting.",
    icon: Megaphone,
    points: ["Meta and Google ads", "Creative testing loops", "Lead quality tracking"],
  },
  {
    title: "Brand Content Studio",
    eyebrow: "content velocity",
    description:
      "Short-form videos, founder-led creative, product explainers, and social-first storytelling for modern brands.",
    icon: Clapperboard,
    points: ["Reels and ad creatives", "Launch campaigns", "Social calendars"],
  },
  {
    title: "Automation Systems",
    eyebrow: "ops layer",
    description:
      "CRM flows, lead routing, AI chat, reporting dashboards, and workflow automations that keep teams moving.",
    icon: Workflow,
    points: ["CRM integrations", "AI-assisted support", "Pipeline automation"],
  },
];

const defaultServiceIconKeys: ServiceIconKey[] = ["website", "marketing", "content", "automation"];

export const defaultServicePlacards: ServicePlacard[] = services.map((service, index) => ({
  ...service,
  id: `default-service-${index + 1}`,
  icon_key: defaultServiceIconKeys[index] || "website",
  is_active: true,
  sort_order: index + 1,
}));

export const performanceMetrics: Metric[] = [
  {
    value: "3.4x",
    label: "average ROAS lift",
    detail: "Across campaign rebuilds after creative and landing-page alignment.",
  },
  {
    value: "42%",
    label: "lower cost per lead",
    detail: "From segmented funnels, better qualification, and retargeting loops.",
  },
  {
    value: "89",
    label: "performance score target",
    detail: "Technical builds ship with Core Web Vitals and accessibility checks.",
  },
  {
    value: "21d",
    label: "launch sprint",
    detail: "Strategy, prototype, build, analytics, and campaign handoff in one cycle.",
  },
];

export const processSteps: ProcessStep[] = [
  {
    step: "01",
    title: "Map the demand",
    description:
      "We find where buyers already hesitate, compare, search, and decide, then shape the website around that journey.",
  },
  {
    step: "02",
    title: "Prototype the proof",
    description:
      "The first interactive draft focuses on services, credibility, metrics, offers, and the clearest next action.",
  },
  {
    step: "03",
    title: "Build the system",
    description:
      "Reusable sections, animation rules, analytics events, and content modules make the site easy to expand.",
  },
  {
    step: "04",
    title: "Optimize the loop",
    description:
      "Campaign data feeds weekly improvements across creative, copy, landing pages, and automation flows.",
  },
];

export const caseStudies: CaseStudy[] = [
  {
    brand: "Urban service marketplace",
    category: "Website + paid ads",
    result: "+186% qualified leads",
    description:
      "Rebuilt the acquisition page, added trust-led service blocks, and connected every form to a faster CRM follow-up.",
  },
  {
    brand: "D2C lifestyle brand",
    category: "Creative studio",
    result: "2.8x repeatable ROAS",
    description:
      "Created a creator-style ad system and product storytelling pages that made testing cheaper and faster.",
  },
  {
    brand: "Local premium clinic",
    category: "SEO + automation",
    result: "64% more booked calls",
    description:
      "Repositioned the service pages, added local search architecture, and automated booking qualification.",
  },
];

export const capabilities = [
  { label: "Landing Pages", icon: MousePointer2 },
  { label: "Creative Ads", icon: Sparkles },
  { label: "SEO Systems", icon: Search },
  { label: "Analytics", icon: LineChart },
  { label: "AI Workflows", icon: Bot },
  { label: "Brand Assets", icon: Blocks },
  { label: "Speed Audits", icon: Gauge },
  { label: "Trust Signals", icon: ShieldCheck },
  { label: "Targeting", icon: Target },
  { label: "Reporting", icon: BarChart3 },
];

export const careerReasons: CareerPoint[] = [
  {
    title: "Work close to real growth",
    description:
      "You will see how creative, landing pages, automation, and campaigns connect to measurable business outcomes.",
    icon: Target,
  },
  {
    title: "Learn with senior systems",
    description:
      "Every project uses reusable playbooks, feedback loops, and clear review rituals so good work compounds.",
    icon: GraduationCap,
  },
  {
    title: "Build with AI beside you",
    description:
      "MADY labs uses AI agents for research, onboarding, QA, documentation, and faster handoffs between teams.",
    icon: Bot,
  },
];

export const careerExpectations = [
  "Structured onboarding with an AI HR guide for policies, tools, tasks, and first-week checklists.",
  "Fast creative sprints across web, ads, content, SEO, automation, and client reporting.",
  "Weekly performance reviews focused on clarity, ownership, communication, and measurable output.",
  "A culture where curiosity, documentation, and clean execution matter as much as raw speed.",
];

export const onboardingFlow = [
  { label: "Profile review", detail: "Role fit, portfolio scan, availability, and growth goals." },
  { label: "AI HR briefing", detail: "A guided chat explains tools, rules, team norms, and first tasks." },
  { label: "Trial sprint", detail: "Small real-world assignment with feedback from the project lead." },
  { label: "Join the pod", detail: "Get assigned to client work, standups, and performance dashboards." },
];
