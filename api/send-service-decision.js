import nodemailer from "nodemailer";
import { createSign, randomUUID } from "crypto";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const envValue = (key) => process.env[key]?.trim();
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const normalizePrivateKey = (key = "") => key.replace(/\\n/g, "\n");

const getGoogleAccessToken = async () => {
  const clientEmail = envValue("GOOGLE_SERVICE_ACCOUNT_EMAIL") || envValue("GOOGLE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(envValue("GOOGLE_PRIVATE_KEY"));
  const delegatedUser = envValue("GOOGLE_WORKSPACE_IMPERSONATED_USER") || envValue("GOOGLE_IMPERSONATED_USER");

  if (!clientEmail || !privateKey) {
    throw new Error("Google Meet creation needs GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Vercel.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = toBase64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: GOOGLE_CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
      ...(delegatedUser ? { sub: delegatedUser } : {}),
    }),
  );
  const unsignedJwt = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(privateKey, "base64");
  const jwt = `${unsignedJwt}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json().catch(() => null);

  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error_description || tokenData?.error || "Google OAuth token request failed.");
  }

  return tokenData.access_token;
};

const createGoogleMeet = async ({ requestId, userEmail, userName, serviceTitle, note, companyEmail }) => {
  const accessToken = await getGoogleAccessToken();
  const calendarId = encodeURIComponent(envValue("GOOGLE_CALENDAR_ID") || companyEmail || "primary");
  const timeZone = envValue("GOOGLE_CALENDAR_TIME_ZONE") || "Asia/Kolkata";
  const startDelayMinutes = Number(envValue("GOOGLE_MEET_START_DELAY_MINUTES") || 60);
  const durationMinutes = Number(envValue("GOOGLE_MEET_DURATION_MINUTES") || 30);
  const start = new Date(Date.now() + Math.max(startDelayMinutes, 0) * 60 * 1000);
  const end = new Date(start.getTime() + Math.max(durationMinutes, 15) * 60 * 1000);
  const attendeesEnabled = envValue("GOOGLE_CALENDAR_INCLUDE_ATTENDEES") !== "false";

  const eventResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `MADY labs consultation: ${serviceTitle}`,
        description: [
          `Requester: ${userName} (${userEmail})`,
          `Request ID: ${requestId || "not provided"}`,
          "",
          "Acceptance note:",
          note,
        ].join("\n"),
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
        ...(attendeesEnabled
          ? {
              attendees: [
                { email: userEmail, displayName: userName },
                ...(companyEmail ? [{ email: companyEmail, displayName: "MADY labs" }] : []),
              ],
            }
          : {}),
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    },
  );

  const eventData = await eventResponse.json().catch(() => null);

  if (!eventResponse.ok) {
    throw new Error(eventData?.error?.message || "Google Calendar event creation failed.");
  }

  const meetLink =
    eventData?.hangoutLink ||
    eventData?.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === "video")?.uri ||
    "";

  if (!meetLink) {
    throw new Error("Google Calendar created the event, but did not return a Google Meet link.");
  }

  return {
    meetLink,
    calendarEventId: eventData?.id || "",
  };
};

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

    const meetDetails = isAccepted
      ? await createGoogleMeet({ requestId, userEmail, userName, serviceTitle, note, companyEmail })
      : null;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const from = `MADY labs <${companyEmail || gmailUser}>`;
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
        ${
          meetDetails?.meetLink
            ? `<h3>Google Meet</h3>
        <p>Your request is accepted. Join your consultation here:</p>
        <p><a href="${escapeHtml(meetDetails.meetLink)}">${escapeHtml(meetDetails.meetLink)}</a></p>`
            : ""
        }
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
        ${meetDetails?.meetLink ? `<p><strong>Google Meet:</strong> <a href="${escapeHtml(meetDetails.meetLink)}">${escapeHtml(meetDetails.meetLink)}</a></p>` : ""}
      `,
    });

    return response.status(200).json({
      ok: true,
      requestId,
      meetLink: meetDetails?.meetLink || null,
      calendarEventId: meetDetails?.calendarEventId || null,
    });
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
