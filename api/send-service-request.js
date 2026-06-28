import nodemailer from "nodemailer";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const transcriptToHtml = (transcript = "") =>
  transcript
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

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
    const { requestId, userEmail, userName, serviceTitle, transcript } = request.body || {};

    if (!userEmail || !userName || !serviceTitle || !transcript) {
      return response.status(400).json({
        ok: false,
        error: "Missing required email payload fields.",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const transcriptHtml = transcriptToHtml(transcript);
    const from = `MADY Media <${gmailUser}>`;

    await transporter.sendMail({
      from,
      to: companyEmail,
      replyTo: userEmail,
      subject: `New MADY service request: ${serviceTitle}`,
      html: `
        <h2>New service request</h2>
        <p>${escapeHtml(userName)} requested ${escapeHtml(serviceTitle)}.</p>
        ${transcriptHtml}
        <p>Request ID: ${escapeHtml(requestId || "not provided")}</p>
      `,
    });

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: `Your MADY Media request for ${serviceTitle}`,
      html: `
        <h2>Thank you, ${escapeHtml(userName)}</h2>
        <p>Your request has reached MADY Media. We will review the details and get back to you with the next step.</p>
        <h3>Your transcript</h3>
        ${transcriptHtml}
      `,
    });

    return response.status(200).json({ ok: true, requestId });
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
