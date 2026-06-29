import { FormEvent, useMemo, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";

type Message = {
  id: number;
  author: "seek" | "user";
  text: string;
};

type Intake = {
  name?: string;
  interest?: string;
  contact?: string;
};

type SeekChatbotProps = {
  placement?: "floating" | "inline";
  launcherLabel?: string;
  scope?: "general" | "career";
};

const generalStarterMessages: Message[] = [
  {
    id: 1,
    author: "seek",
    text: "Hi, I am Seek, MADY labs' AI assistant. I can collect your details and route you to the right next step.",
  },
  {
    id: 2,
    author: "seek",
    text: "First, what is your name?",
  },
];

const careerStarterMessages: Message[] = [
  {
    id: 1,
    author: "seek",
    text: "Hi, I am Seek, MADY labs' AI HR assistant. I can collect your applicant details and prepare your onboarding path.",
  },
  {
    id: 2,
    author: "seek",
    text: "First, what is your name?",
  },
];

function createSeekReply(message: string, intake: Intake, scope: "general" | "career") {
  const nextIntake = { ...intake };
  const cleanMessage = message.trim();
  const lower = cleanMessage.toLowerCase();

  if (!nextIntake.name) {
    nextIntake.name = cleanMessage;
    if (scope === "career") {
      return {
        intake: nextIntake,
        text: `Nice to meet you, ${cleanMessage}. Which role are you interested in at MADY labs?`,
      };
    }

    return {
      intake: nextIntake,
      text: `Nice to meet you, ${cleanMessage}. Are you here for agency services, a career opportunity, or a partnership?`,
    };
  }

  if (!nextIntake.interest) {
    nextIntake.interest = cleanMessage;
    if (scope === "career") {
      return {
        intake: nextIntake,
        text: "Great. Please share your email, phone, LinkedIn, or portfolio link so HR can follow up.",
      };
    }

    if (lower.includes("career") || lower.includes("job") || lower.includes("intern")) {
      return {
        intake: nextIntake,
        text: "Great. I will treat this as an applicant conversation. Please share your email, phone, or portfolio link so HR can follow up.",
      };
    }

    return {
      intake: nextIntake,
      text: "Got it. I will treat this as a business inquiry. Please share your email, phone, or WhatsApp number so the team can contact you.",
    };
  }

  if (!nextIntake.contact) {
    nextIntake.contact = cleanMessage;
    if (scope === "career") {
      return {
        intake: nextIntake,
        text: `Thanks. I captured your applicant intake: Name: ${nextIntake.name}; Role interest: ${nextIntake.interest}; Contact or portfolio: ${cleanMessage}. For now I am a front-end AI HR chatbot, ready to connect to a real onboarding workflow next.`,
      };
    }

    return {
      intake: nextIntake,
      text: `Thanks. I captured: Name: ${nextIntake.name}; Interest: ${nextIntake.interest}; Contact: ${cleanMessage}. For now I am a front-end chatbot, so this is ready to connect to a CRM or AI backend next.`,
    };
  }

  if (lower.includes("service") || lower.includes("website") || lower.includes("ads")) {
    return {
      intake: nextIntake,
      text: "For services, MADY labs can help with websites, performance marketing, content, automation, and reporting. Tell me your budget or launch timeline next.",
    };
  }

  if (lower.includes("career") || lower.includes("apply") || lower.includes("job")) {
    return {
      intake: nextIntake,
      text: "For careers, open the Career page from the nav. I can help pre-screen your interest and prepare an onboarding checklist.",
    };
  }

  return {
    intake: nextIntake,
    text:
      scope === "career"
        ? "I have your core applicant details. You can add availability, experience, portfolio notes, or salary expectations, and I will keep the intake organized."
        : "I have your core details. You can add goals, timeline, budget, or role interest, and I will keep the conversation organized.",
  };
}

export function SeekChatbot({
  placement = "floating",
  launcherLabel = "Seek",
  scope = "general",
}: SeekChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [intake, setIntake] = useState<Intake>({});
  const [messages, setMessages] = useState<Message[]>(
    scope === "career" ? careerStarterMessages : generalStarterMessages
  );

  const statusText = useMemo(() => {
    if (!intake.name) return "Collecting name";
    if (!intake.interest) return "Finding intent";
    if (!intake.contact) return "Waiting for contact";
    return "Info captured";
  }, [intake]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanInput = input.trim();
    if (!cleanInput) return;

    const userMessage: Message = {
      id: Date.now(),
      author: "user",
      text: cleanInput,
    };
    const reply = createSeekReply(cleanInput, intake, scope);
    const seekMessage: Message = {
      id: Date.now() + 1,
      author: "seek",
      text: reply.text,
    };

    setMessages((current) => [...current, userMessage, seekMessage]);
    setIntake(reply.intake);
    setInput("");
  };

  return (
    <div className={`seek-widget seek-${placement}${isOpen ? " is-open" : ""}`}>
      {isOpen ? (
        <section className="seek-panel" aria-label="Seek AI chatbot">
          <header className="seek-header">
            <div>
              <span>
                <Bot size={18} aria-hidden="true" />
                Seek
              </span>
              <p>{statusText}</p>
            </div>
            <button type="button" aria-label="Close Seek chat" onClick={() => setIsOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
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
              placeholder="Type your answer..."
            />
            <button type="submit" aria-label="Send message to Seek">
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      ) : null}
      <button
        className="seek-launcher"
        type="button"
        aria-label="Open Seek AI chatbot"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Sparkles size={20} aria-hidden="true" />
        <span>{launcherLabel}</span>
      </button>
    </div>
  );
}
