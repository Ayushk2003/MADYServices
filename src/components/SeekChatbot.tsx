import { type FormEvent, useMemo, useState } from "react";
import { Bot, PhoneCall, Send, Sparkles, UserCheck, X } from "lucide-react";
import { useAuthGate } from "./AuthGate";
import { supabase } from "../supabaseClient";

type Message = {
  id: number;
  author: "seek" | "user";
  text: string;
};

type IntakeStep = "confirm_profile" | "role" | "experience" | "portfolio" | "availability" | "notes" | "complete";

type Intake = {
  name: string;
  email: string;
  roleInterest: string;
  experience: string;
  portfolio: string;
  availability: string;
  notes: string;
};

type ProfileDetails = {
  name: string;
  email: string;
};

type SeekChatbotProps = {
  placement?: "floating" | "inline";
  launcherLabel?: string;
  scope?: "general" | "career";
};

const emptyIntake: Intake = {
  name: "",
  email: "",
  roleInterest: "",
  experience: "",
  portfolio: "",
  availability: "",
  notes: "",
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const formatProfile = (profile: ProfileDetails) =>
  `${profile.name || "MADY applicant"} (${profile.email || "email not found"})`;

const parseProfileCorrection = (value: string, fallback: ProfileDetails): ProfileDetails => {
  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0] || fallback.email;
  const name = value
    .replace(email, "")
    .replace(/name|email|is|:|,/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: name || fallback.name,
    email: normalizeEmail(email),
  };
};

export function SeekChatbot({
  placement = "floating",
  launcherLabel = "Meet Seek",
  scope = "general",
}: SeekChatbotProps) {
  const { user } = useAuthGate();
  const [isOpen, setIsOpen] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<IntakeStep>("confirm_profile");
  const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null);
  const [intake, setIntake] = useState<Intake>(emptyIntake);
  const [messages, setMessages] = useState<Message[]>([]);

  const statusText = useMemo(() => {
    if (isSaving) return "Emailing intake";
    if (step === "confirm_profile") return "Confirming profile";
    if (step === "role") return "Role interest";
    if (step === "experience") return "Experience";
    if (step === "portfolio") return "Portfolio";
    if (step === "availability") return "Availability";
    if (step === "notes") return "Final notes";
    return "Intake sent";
  }, [isSaving, step]);

  const createMessage = (author: Message["author"], text: string): Message => ({
    id: Date.now() + Math.random(),
    author,
    text,
  });

  const addSeekMessage = (text: string) => {
    setMessages((current) => [...current, createMessage("seek", text)]);
  };

  const loadProfile = async () => {
    const fallbackProfile = {
      name: user?.name || "MADY applicant",
      email: user?.email || "",
    };

    if (!supabase || !user) {
      return fallbackProfile;
    }

    const { data } = await supabase
      .from("profiles")
      .select("name,email")
      .eq("id", user.id)
      .maybeSingle();

    return {
      name: data?.name || fallbackProfile.name,
      email: data?.email || fallbackProfile.email,
    };
  };

  const openSeek = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsCalling(true);
    const profile = await loadProfile().catch(() => ({
      name: user?.name || "MADY applicant",
      email: user?.email || "",
    }));
    const normalizedProfile = {
      name: profile.name,
      email: normalizeEmail(profile.email),
    };

    setProfileDetails(normalizedProfile);
    setIntake({ ...emptyIntake, name: normalizedProfile.name, email: normalizedProfile.email });
    setStep("confirm_profile");
    setMessages([
      createMessage("seek", "Hi, I am Seek. I will collect your applicant intake and email it to MADY labs HR."),
      createMessage("seek", `I found this profile from your account: ${formatProfile(normalizedProfile)}. Reply Yes to confirm, or type the correct name and email.`),
    ]);
    setIsOpen(true);
    setIsCalling(false);
  };

  const transcriptFor = (nextIntake: Intake) =>
    [
      `Name: ${nextIntake.name}`,
      `Email: ${nextIntake.email}`,
      `Role interest: ${nextIntake.roleInterest}`,
      `Experience: ${nextIntake.experience}`,
      `Portfolio: ${nextIntake.portfolio || "Not provided"}`,
      `Availability: ${nextIntake.availability}`,
      `Notes: ${nextIntake.notes || "None"}`,
      "",
      ...messages.map((message) => `${message.author === "seek" ? "Seek" : "Applicant"}: ${message.text}`),
    ].join("\n");

  const sendIntakeEmail = async (nextIntake: Intake) => {
    setIsSaving(true);
    const response = await fetch("/api/send-seek-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...nextIntake,
        email: normalizeEmail(nextIntake.email),
        transcript: transcriptFor(nextIntake),
        scope,
      }),
    }).catch((error) => error as Error);
    setIsSaving(false);

    if (response instanceof Error) {
      addSeekMessage(`I collected your details, but email sending failed: ${response.message}`);
      return;
    }

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as { error?: string } | null;
      addSeekMessage(`I collected your details, but email sending failed: ${details?.error || response.statusText}`);
      return;
    }

    setStep("complete");
    addSeekMessage("Your Seek intake has been emailed to MADY labs HR. A confirmation email was also sent to your profile email.");
  };

  const handleStep = async (cleanInput: string) => {
    let nextIntake = { ...intake };
    const lower = cleanInput.toLowerCase();

    if (step === "confirm_profile") {
      if (lower === "yes" || lower === "y" || lower.includes("confirm") || lower.includes("correct")) {
        setStep("role");
        addSeekMessage("Profile confirmed. Which role, internship, or team are you interested in?");
        return;
      }

      const correctedProfile = parseProfileCorrection(cleanInput, profileDetails || { name: intake.name, email: intake.email });
      nextIntake = { ...nextIntake, ...correctedProfile };
      setProfileDetails(correctedProfile);
      setIntake(nextIntake);
      setStep("role");
      addSeekMessage(`Updated profile to ${formatProfile(correctedProfile)}. Which role, internship, or team are you interested in?`);
      return;
    }

    if (step === "role") {
      nextIntake.roleInterest = cleanInput;
      setIntake(nextIntake);
      setStep("experience");
      addSeekMessage("Good. Share your experience level, strongest skills, and any tools you already use.");
      return;
    }

    if (step === "experience") {
      nextIntake.experience = cleanInput;
      setIntake(nextIntake);
      setStep("portfolio");
      addSeekMessage("Add your portfolio, LinkedIn, GitHub, resume link, or write Not ready if you do not have one yet.");
      return;
    }

    if (step === "portfolio") {
      nextIntake.portfolio = cleanInput;
      setIntake(nextIntake);
      setStep("availability");
      addSeekMessage("When can you start, and are you looking for full-time, internship, freelance, or part-time work?");
      return;
    }

    if (step === "availability") {
      nextIntake.availability = cleanInput;
      setIntake(nextIntake);
      setStep("notes");
      addSeekMessage("Last one. Add anything HR should know: location, expected pay, work samples, preferred schedule, or interview timing.");
      return;
    }

    if (step === "notes") {
      nextIntake.notes = cleanInput;
      setIntake(nextIntake);
      await sendIntakeEmail(nextIntake);
      return;
    }

    addSeekMessage("Your intake has already been sent. You can close Seek or start again later.");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanInput = input.trim();
    if (!cleanInput || isSaving) return;

    setMessages((current) => [...current, createMessage("user", cleanInput)]);
    setInput("");
    void handleStep(cleanInput);
  };

  return (
    <div className={`seek-widget seek-${placement}${isOpen ? " is-open" : ""}`}>
      {isOpen ? (
        <section className="seek-panel" aria-label="Meet Seek applicant intake chatbot">
          <header className="seek-header">
            <div>
              <span>
                <Bot size={18} aria-hidden="true" />
                Meet Seek
              </span>
              <p>{statusText}</p>
            </div>
            <button type="button" aria-label="Close Seek chat" onClick={() => setIsOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="seek-profile-chip" aria-label="Fetched applicant profile">
            <UserCheck size={16} aria-hidden="true" />
            {profileDetails ? formatProfile(profileDetails) : "Profile loading"}
          </div>
          <div className="seek-messages">
            {messages.map((message) => (
              <p className={`seek-message ${message.author}`} key={message.id}>
                {message.text}
              </p>
            ))}
          </div>
          <form className="seek-input" onSubmit={handleSubmit}>
            <input
              aria-label="Message Seek"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={step === "confirm_profile" ? "Yes, or correct name and email" : "Type your answer..."}
              disabled={isSaving}
            />
            <button type="submit" aria-label="Send message to Seek" disabled={isSaving}>
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      ) : null}
      <button
        className="seek-launcher"
        type="button"
        aria-label="Open Meet Seek"
        onClick={() => void openSeek()}
        disabled={isCalling}
      >
        {isCalling ? <PhoneCall size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}
        <span>{isCalling ? "Calling Seek...." : launcherLabel}</span>
      </button>
    </div>
  );
}
