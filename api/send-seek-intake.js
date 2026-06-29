import nodemailer from "nodemailer";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const envValue = (key) => process.env[key]?.trim();

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const gmailUser = envValue("GMAIL_USER");
  const gmailAppPassword = envValue("GMAIL_APP_PASSWORD");
  const companyEmail = envValue("COMPANY_EMAIL") || "hello@madymedia.agency";

  if (!gmailUser || !gmailAppPassword) {
    return response.status(500).json({
      ok: false,
      error: "GMAIL_USER and GMAIL_APP_PASSWORD are not configured in Vercel.",
    });
  }

  try {
    const { name, email, roleInterest, experience, portfolio, availability, notes, transcript } = request.body || {};

    if (!name || !email || !roleInterest || !experience || !availability) {
      return response.status(400).json({
        ok: false,
        error: "Missing required Seek intake fields.",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const from = `MADY labs <${gmailUser}>`;

    await transporter.sendMail({
      from,
      to: companyEmail,
      replyTo: email,
      subject: `New Seek applicant intake: ${roleInterest}`,
      html: `
        <h2>New Seek applicant intake</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Role interest:</strong> ${escapeHtml(roleInterest)}</p>
        <p><strong>Experience:</strong> ${escapeHtml(experience)}</p>
        <p><strong>Portfolio:</strong> ${escapeHtml(portfolio || "Not provided")}</p>
        <p><strong>Availability:</strong> ${escapeHtml(availability)}</p>
        <p><strong>Notes:</strong> ${escapeHtml(notes || "None")}</p>
        <h3>Seek transcript</h3>
        <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(transcript || "")}</pre>
      `,
    });

    await transporter.sendMail({
      from,
      to: email,
      replyTo: companyEmail,
      subject: "Your MADY labs Seek intake was received",
      html: `
        <h2>Thanks, ${escapeHtml(name)}</h2>
        <p>Seek sent your applicant intake to MADY labs. The team can review your role interest, experience, portfolio, availability, and notes.</p>
        <p><strong>Role interest:</strong> ${escapeHtml(roleInterest)}</p>
        <p>Reply to this email if you want to add anything else.</p>
      `,
    });

    return response.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isGmailAuthError = message.includes("535") || message.toLowerCase().includes("badcredentials");

    return response.status(500).json({
      ok: false,
      error: isGmailAuthError
        ? "Gmail rejected the SMTP login. Use your Gmail address with no spaces and a Google App Password, not your normal Gmail password."
        : message,
    });
  }
}
