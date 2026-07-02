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
    const { feedbackId, message, userEmail, userId, userName, page } = request.body || {};

    if (!message) {
      return response.status(400).json({ ok: false, error: "Feedback message is required." });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `MADY labs <${gmailUser}>`,
      to: companyEmail,
      replyTo: userEmail && userEmail !== "Not logged in" ? userEmail : gmailUser,
      subject: "New MADY website feedback",
      html: `
        <h2>New website feedback</h2>
        <p><strong>Feedback ID:</strong> ${escapeHtml(feedbackId || "Not saved")}</p>
        <p><strong>User ID:</strong> ${escapeHtml(userId || "Not available")}</p>
        <p><strong>From:</strong> ${escapeHtml(userName || "MADY website visitor")}</p>
        <p><strong>Email:</strong> ${escapeHtml(userEmail || "Not logged in")}</p>
        <p><strong>Page:</strong> ${escapeHtml(page || "/")}</p>
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
    });

    return response.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isGmailAuthError = message.includes("535") || message.toLowerCase().includes("badcredentials");

    return response.status(500).json({
      ok: false,
      error: isGmailAuthError
        ? "Gmail rejected the SMTP login. Use a Google App Password, not your normal Gmail password."
        : message,
    });
  }
}
