import { createClient } from "@supabase/supabase-js";

const TESTING_OWNER_EMAIL = "ayushkushwaha182003@gmail.com";

const envValue = (key) => process.env[key]?.trim();
const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const sendJson = (response, status, payload) =>
  response.status(status).json(payload);

const requireNoError = async (work, message) => {
  const { error } = await work;
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
};

const deleteByUserOrEmail = async (supabase, table, userId, email) => {
  if (userId) {
    await requireNoError(supabase.from(table).delete().eq("user_id", userId), `Delete ${table} user rows failed`);
  }

  if (email) {
    await requireNoError(supabase.from(table).delete().ilike("email", email), `Delete ${table} email rows failed`);
  }
};

const clearStaffReferences = async (supabase, table, userId) => {
  await requireNoError(
    supabase.from(table).update({ claimed_by: null, claimed_at: null }).eq("claimed_by", userId),
    `Clear ${table} claimed rows failed`,
  );
  await requireNoError(
    supabase.from(table).update({ decision_by: null }).eq("decision_by", userId),
    `Clear ${table} decision rows failed`,
  );
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(response, 500, {
      error: "Staff deletion needs SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL configured on the server.",
    });
  }

  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return sendJson(response, 401, { error: "Missing admin session." });
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
      return sendJson(response, 401, { error: "Admin session could not be verified." });
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
      return sendJson(response, 403, { error: "Only admins can delete agency staff." });
    }

    const targetProfileId = String(request.body?.target_profile_id || "").trim();
    const requestedTargetEmail = normalizeEmail(request.body?.target_email);

    if (!targetProfileId && !requestedTargetEmail) {
      return sendJson(response, 400, { error: "Staff id or email is required." });
    }

    const { data: targetProfile, error: targetProfileError } = targetProfileId
      ? await supabase.from("profiles").select("id,email").eq("id", targetProfileId).maybeSingle()
      : await supabase.from("profiles").select("id,email").ilike("email", requestedTargetEmail).maybeSingle();

    if (targetProfileError) {
      throw new Error(`Staff lookup failed: ${targetProfileError.message}`);
    }

    const targetUserId = targetProfile?.id || targetProfileId;
    const targetEmail = normalizeEmail(targetProfile?.email || requestedTargetEmail);

    if (!targetUserId) {
      return sendJson(response, 404, { error: "Staff profile was not found." });
    }

    if (targetUserId === requester.id) {
      return sendJson(response, 400, { error: "You cannot delete your own admin account." });
    }

    if (targetEmail === TESTING_OWNER_EMAIL) {
      return sendJson(response, 400, { error: "Testing owner ID is protected." });
    }

    await deleteByUserOrEmail(supabase, "service_requests", targetUserId, targetEmail);
    await deleteByUserOrEmail(supabase, "asked_services", targetUserId, targetEmail);
    await clearStaffReferences(supabase, "service_requests", targetUserId);
    await clearStaffReferences(supabase, "asked_services", targetUserId);
    await requireNoError(
      supabase.from("service_placards").update({ created_by: null }).eq("created_by", targetUserId),
      "Clear placard creator rows failed",
    );
    await requireNoError(
      supabase.from("service_placards").update({ updated_by: null }).eq("updated_by", targetUserId),
      "Clear placard updater rows failed",
    );
    await requireNoError(
      supabase.from("agency_invites").delete().ilike("email", targetEmail),
      "Delete staff invite rows failed",
    );
    await requireNoError(
      supabase.from("agency_invites").delete().eq("accepted_by", targetUserId),
      "Delete accepted invite rows failed",
    );
    await requireNoError(
      supabase.from("profiles").delete().eq("id", targetUserId),
      "Delete staff profile failed",
    );

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(targetUserId);

    if (deleteUserError && deleteUserError.status !== 404) {
      throw new Error(`Delete Supabase Auth user failed: ${deleteUserError.message}`);
    }

    return sendJson(response, 200, {
      ok: true,
      deletedUserId: targetUserId,
      deletedEmail: targetEmail,
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Staff deletion failed.",
    });
  }
}
