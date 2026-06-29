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
    const { requestId, userEmail, userName, serviceTitle, decision, note, decidedBy } = request.body || {};
    const isAccepted = decision === "accepted";
    const isRejected = decision === "rejected";

    if (!userEmail || !userName || !serviceTitle || !note || (!isAccepted && !isRejected)) {
      return response.status(400).json({
        ok: false,
        error: "Missing required decision email payload fields.",
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
    const subject = isAccepted
      ? `Congratulations, your MADY labs request was accepted`
      : `Update on your MADY labs request`;
    const intro = isAccepted
      ? "Congratulations. Our team has accepted your service request and is ready to move it into the next step."
      : "Thank you for sharing your request with us. After review, we are not accepting this request right now.";

    await transporter.sendMail({
      from,
      to: userEmail,
      replyTo: companyEmail,
      subject,
      html: `
        <h2>${isAccepted ? "Your service request is accepted" : "Your service request was reviewed"}</h2>
        <p>Hi ${escapeHtml(userName)},</p>
        <p>${escapeHtml(intro)}</p>
        <p><strong>Service:</strong> ${escapeHtml(serviceTitle)}</p>
        <h3>Message from MADY labs</h3>
        <p>${escapeHtml(note)}</p>
        <p>Reply to this email if you want to discuss the next step with our team.</p>
      `,
    });

    await transporter.sendMail({
      from,
      to: companyEmail,
      subject: `MADY labs request ${decision}: ${serviceTitle}`,
      html: `
        <h2>Service request ${escapeHtml(decision)}</h2>
        <p><strong>Requester:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>
        <p><strong>Handled by:</strong> ${escapeHtml(decidedBy || "Portal staff")}</p>
        <p><strong>Request ID:</strong> ${escapeHtml(requestId || "not provided")}</p>
        <p><strong>Note:</strong> ${escapeHtml(note)}</p>
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
