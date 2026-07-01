import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const TESTING_OWNER_EMAIL = "ayushkushwaha182003@gmail.com";

const envValue = (key) => process.env[key]?.trim();
const normalizeEmail = (email = "") => String(email).trim().toLowerCase();
const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sendJson = (response, status, payload) => response.status(status).json(payload);

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { ok: false, error: "Method not allowed." });
  }

  const gmailUser = envValue("GMAIL_USER");
  const gmailAppPassword = envValue("GMAIL_APP_PASSWORD");
  const companyEmail = envValue("COMPANY_EMAIL") || gmailUser;
  const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!gmailUser || !gmailAppPassword) {
    return sendJson(response, 500, {
      ok: false,
      error: "GMAIL_USER and GMAIL_APP_PASSWORD are not configured in Vercel.",
    });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(response, 500, {
      ok: false,
      error: "Staff invite email needs SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL configured on the server.",
    });
  }

  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return sendJson(response, 401, { ok: false, error: "Missing admin session." });
  }

  const { inviteEmail, inviteName, inviteRole, expiresAt } = request.body || {};
  const email = normalizeEmail(inviteEmail);
  const role = inviteRole === "admin" || inviteRole === "manager" ? inviteRole : null;

  if (!email || !role || !expiresAt) {
    return sendJson(response, 400, { ok: false, error: "Missing staff invite email fields." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const {
      data: { user: requester },
      error: requesterError,
    } = await supabase.auth.getUser(token);

    if (requesterError || !requester) {
      return sendJson(response, 401, { ok: false, error: "Admin session could not be verified." });
    }

    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from("profiles")
      .select("email,role")
      .eq("id", requester.id)
      .maybeSingle();

    if (requesterProfileError) {
      throw new Error(`Admin profile check failed: ${requesterProfileError.message}`);
    }

    const requesterEmail = normalizeEmail(requesterProfile?.email || requester.email);
    const isAdmin = requesterProfile?.role === "admin" || requesterEmail === TESTING_OWNER_EMAIL;

    if (!isAdmin) {
      return sendJson(response, 403, { ok: false, error: "Only admins can email staff invites." });
    }

    const expiresText = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(expiresAt));
    const registerUrl = `${request.headers.origin || "https://madylabs.com"}/admin`;
    const displayName = inviteName ? escapeHtml(inviteName) : "there";
    const roleLabel = role === "admin" ? "Admin" : "Manager";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `MADY labs <${gmailUser}>`,
      to: email,
      replyTo: companyEmail,
      subject: `MADY labs ${roleLabel} invite`,
      html: `
        <h2>MADY labs staff invite</h2>
        <p>Hi ${displayName},</p>
        <p>You have been invited to join MADY labs as ${escapeHtml(roleLabel)}.</p>
        <p>This invite expires in 24 hours, on <strong>${escapeHtml(expiresText)}</strong>.</p>
        <p><a href="${escapeHtml(registerUrl)}">Accept your invite</a></p>
        <p>If the invite expires or is deleted by an admin, this link will no longer create staff access.</p>
      `,
    });

    return sendJson(response, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isGmailAuthError = message.includes("535") || message.toLowerCase().includes("badcredentials");

    return sendJson(response, 500, {
      ok: false,
      error: isGmailAuthError
        ? "Gmail rejected the SMTP login. Use your Gmail address with no spaces and a Google App Password, not your normal Gmail password."
        : message,
    });
  }
}
