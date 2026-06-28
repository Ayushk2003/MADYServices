import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Lock, RefreshCw, ShieldCheck, UserCheck, Users, X } from "lucide-react";
import { useAuthGate } from "./AuthGate";
import { supabase } from "../supabaseClient";
import { hasAllowedAdminPageEntry, isTestingOwnerEmail } from "../access";

type RequestStatus = "new" | "in_process" | "delivered" | "closed";

type ServiceRequest = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  project_type: string;
  service_title: string | null;
  service_info: string | null;
  requirements: string | null;
  message: string;
  status: RequestStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

type ProfileSummary = {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin" | "manager";
  created_at?: string;
};

type AgencyInvite = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "manager";
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
};

type DuplicateEmailInfo = {
  email: string;
  source: "profile" | "invite" | "both";
  profileRole?: ProfileSummary["role"];
  inviteRole?: AgencyInvite["role"];
};

type StaffRow =
  | {
      kind: "profile";
      id: string;
      name: string;
      email: string;
      role: ProfileSummary["role"];
      created_at?: string;
    }
  | {
      kind: "invite";
      id: string;
      name: string | null;
      email: string;
      role: AgencyInvite["role"];
      created_at: string;
    };

const statusLabel: Record<RequestStatus, string> = {
  new: "New",
  in_process: "In process",
  delivered: "Delivered",
  closed: "Closed",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function AdminRequests() {
  const { user, isAuthReady, openAuth } = useAuthGate();
  const [hasAdminEntry] = useState(() => hasAllowedAdminPageEntry());
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [teamProfiles, setTeamProfiles] = useState<ProfileSummary[]>([]);
  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const [duplicateEmail, setDuplicateEmail] = useState<DuplicateEmailInfo | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);

  const isAgencyManager = user?.role === "admin" || user?.role === "manager";
  const isAdmin = user?.role === "admin";

  const showAdminToast = (nextMessage: string) => {
    setToastMessage(nextMessage);
    window.setTimeout(() => setToastMessage(""), 3200);
  };

  const stats = useMemo(
    () => ({
      new: requests.filter((request) => request.status === "new").length,
      active: requests.filter((request) => request.status === "in_process").length,
      done: requests.filter((request) => request.status === "delivered").length,
    }),
    [requests],
  );

  const staffRows = useMemo<StaffRow[]>(() => {
    const profileRows: StaffRow[] = teamProfiles
      .filter((profile) => profile.role === "admin" || profile.role === "manager")
      .map((profile) => ({
        kind: "profile",
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        created_at: profile.created_at,
      }));

    const profileEmails = new Set(profileRows.map((profile) => profile.email.toLowerCase()));
    const inviteRows: StaffRow[] = invites
      .filter((invite) => !profileEmails.has(invite.email.toLowerCase()))
      .map((invite) => ({
        kind: "invite",
        id: invite.id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
        created_at: invite.created_at,
      }));

    return [...profileRows, ...inviteRows];
  }, [invites, teamProfiles]);

  const fetchRequests = async () => {
    if (!supabase || !isAgencyManager) return;

    setStatus("loading");
    setMessage("");

    const { data, error } = await supabase
      .from("service_requests")
      .select(
        "id,user_id,name,email,project_type,service_title,service_info,requirements,message,status,claimed_by,claimed_at,created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    const nextRequests = (data || []) as ServiceRequest[];
    setRequests(nextRequests);

    const profileIds = Array.from(
      new Set(nextRequests.flatMap((request) => [request.user_id, request.claimed_by]).filter(Boolean) as string[]),
    );

    if (profileIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,name,email,role")
        .in("id", profileIds);

      setProfiles(
        ((profileData || []) as ProfileSummary[]).reduce<Record<string, ProfileSummary>>((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {}),
      );
    } else {
      setProfiles({});
    }

    if (isAdmin) {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id,name,email,role,created_at")
        .order("created_at", { ascending: false });

      setTeamProfiles((allProfiles || []) as ProfileSummary[]);

      const { data: inviteData } = await supabase
        .from("agency_invites")
        .select("id,email,name,role,accepted_by,accepted_at,created_at")
        .order("created_at", { ascending: false });

      setInvites((inviteData || []) as AgencyInvite[]);
    } else {
      setTeamProfiles([]);
      setInvites([]);
    }

    setStatus("idle");
  };

  useEffect(() => {
    if (isAgencyManager) {
      void fetchRequests();
    }
  }, [isAgencyManager]);

  const updateRequest = async (requestId: string, nextStatus: RequestStatus) => {
    if (!supabase || !user) return;

    setStatus("saving");
    setMessage("");

    const updates: Record<string, string> = { status: nextStatus };

    if (nextStatus === "in_process") {
      updates.claimed_by = user.id;
      updates.claimed_at = new Date().toISOString();
    }

    if (nextStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase.from("service_requests").update(updates).eq("id", requestId);

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    await fetchRequests();
  };

  const deleteRequest = async (requestId: string) => {
    if (!supabase || !isAgencyManager) return;

    setStatus("saving");
    setMessage("");
    setToastMessage("");

    const { data, error } = await supabase.from("service_requests").delete().eq("id", requestId).select("id");

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setStatus("error");
      setMessage("Request was not deleted. Apply the latest Supabase delete policy from schema.sql, then try again.");
      return;
    }

    setRequests((current) => current.filter((request) => request.id !== requestId));
    showAdminToast("Request deleted.");
    await fetchRequests();
  };

  const createStaffInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !isAdmin) return;

    const formData = new FormData(event.currentTarget);
    const inviteEmail = String(formData.get("invite_email") || "").trim();
    const inviteName = String(formData.get("invite_name") || "").trim();
    const inviteRole = String(formData.get("invite_role") || "manager") as AgencyInvite["role"];
    const normalizedInviteEmail = inviteEmail.toLowerCase();

    setStatus("saving");
    setMessage("");
    setDuplicateEmail(null);
    setInviteSuccessMessage("");

    const existingProfile = teamProfiles.find((profile) => profile.email.toLowerCase() === normalizedInviteEmail);
    const existingInvite = invites.find((invite) => invite.email.toLowerCase() === normalizedInviteEmail);

    if (existingProfile || existingInvite) {
      setStatus("idle");
      setIsAddAdminOpen(false);
      setDuplicateEmail({
        email: inviteEmail,
        source: existingProfile && existingInvite ? "both" : existingProfile ? "profile" : "invite",
        profileRole: existingProfile?.role,
        inviteRole: existingInvite?.role,
      });
      return;
    }

    const { data, error } = await supabase
      .from("agency_invites")
      .insert({
        email: normalizedInviteEmail,
        name: inviteName || null,
        role: inviteRole,
        invited_by: user?.id || null,
      })
      .select("id,email,name,role,accepted_by,accepted_at,created_at")
      .single();

    if (error) {
      if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
        setStatus("idle");
        setIsAddAdminOpen(false);
        setDuplicateEmail({
          email: inviteEmail,
          source: "invite",
          inviteRole,
        });
        return;
      }

      setStatus("error");
      setMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    setIsAddAdminOpen(false);
    if (data) {
      setInvites((current) => [data as AgencyInvite, ...current]);
    }
    setStatus("idle");
    setInviteSuccessMessage(`New ${inviteRole} added.`);
  };

  const updateProfileRole = async (profileId: string, nextRole: ProfileSummary["role"]) => {
    if (!supabase || !isAdmin) return;

    const targetProfile = teamProfiles.find((profile) => profile.id === profileId);
    if (isTestingOwnerEmail(targetProfile?.email)) {
      setStatus("idle");
      setMessage("");
      showAdminToast("Owner ID is protected.");
      return;
    }

    setStatus("saving");
    setMessage("");
    setInviteSuccessMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", profileId)
      .select("id,name,email,role,created_at")
      .single();

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setTeamProfiles((current) => current.map((profile) => (profile.id === profileId ? (data as ProfileSummary) : profile)));
    setStatus("idle");
    showAdminToast(`Role updated to ${nextRole}.`);
  };

  const removeStaffRow = async (staff: StaffRow) => {
    if (!supabase || !isAdmin) return;

    if ((staff.kind === "profile" && staff.id === user?.id) || isTestingOwnerEmail(staff.email)) {
      setStatus("idle");
      setMessage("");
      showAdminToast(isTestingOwnerEmail(staff.email) ? "Owner ID is protected." : "You cannot remove your own admin access.");
      return;
    }

    setStatus("saving");
    setMessage("");
    setToastMessage("");
    setInviteSuccessMessage("");

    if (staff.kind === "invite") {
      const { data, error } = await supabase.from("agency_invites").delete().eq("id", staff.id).select("id");

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (!data || data.length === 0) {
        setStatus("error");
        setMessage("Invite was not deleted. Apply the latest Supabase invite delete policy from schema.sql, then try again.");
        return;
      }

      setInvites((current) => current.filter((invite) => invite.id !== staff.id));
      showAdminToast("Staff invite deleted.");
      await fetchRequests();
      return;
    }

    const { data, error } = await supabase.from("profiles").update({ role: "member" }).eq("id", staff.id).select("id");

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setStatus("error");
      setMessage("Staff access was not removed. Apply the latest Supabase profile update policy from schema.sql, then try again.");
      return;
    }

    setTeamProfiles((current) => current.map((profile) => (profile.id === staff.id ? { ...profile, role: "member" } : profile)));
    showAdminToast("Staff access removed.");
    await fetchRequests();
  };

  if (!isAuthReady) {
    return (
      <main>
        <section className="admin-page">
          <p className="admin-empty">Checking access...</p>
        </section>
      </main>
    );
  }

  if (!hasAdminEntry) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Restricted staff portal</span>
          <h1>Admin access must start from the site button.</h1>
          <p>Direct URL access to this page is blocked. Use the Admin button in the website header.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/">
              Back home
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <Lock size={34} aria-hidden="true" />
          <span>Admin manager access</span>
          <h1>Login before opening service requests.</h1>
          <p>Only MADY Media admins and managers can access client request details. Invited staff can register from the login popup.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => openAuth("login", "open the admin request desk")}>
              Login
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!isAgencyManager) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Member account</span>
          <h1>This page is only for agency managers.</h1>
          <p>Your account is registered as a regular member. Ask an existing admin to promote your profile role.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="admin-page">
        {toastMessage && (
          <div className="admin-toast" role="status" aria-live="polite">
            {toastMessage}
          </div>
        )}
        {duplicateEmail && (
          <div className="admin-alert-backdrop" role="presentation">
            <section className="admin-alert" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-email-title">
              <button
                className="service-modal-close"
                type="button"
                aria-label="Close duplicate email alert"
                onClick={() => setDuplicateEmail(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
              <span>Already exists</span>
              <h2 id="duplicate-email-title">
                {duplicateEmail.source === "invite" ? "Email already has a pending invite." : "User with current mail already exists."}
              </h2>
              <p>
                {duplicateEmail.email}{" "}
                {duplicateEmail.source === "invite"
                  ? `is already in the invite list as ${duplicateEmail.inviteRole}. They need to register with this email, or you can manage the pending invite from Supabase.`
                  : duplicateEmail.source === "both"
                    ? `has a registered profile as ${duplicateEmail.profileRole} and an invite as ${duplicateEmail.inviteRole}. Use the role dropdown for the profile, or clean up the extra invite in Supabase.`
                    : `is already registered as ${duplicateEmail.profileRole}. Use the role dropdown to change access.`}
              </p>
            </section>
          </div>
        )}
        {inviteSuccessMessage && (
          <div className="admin-alert-backdrop" role="presentation">
            <section className="admin-alert success" role="alertdialog" aria-modal="true" aria-labelledby="admin-success-title">
              <button
                className="service-modal-close"
                type="button"
                aria-label="Close success alert"
                onClick={() => setInviteSuccessMessage("")}
              >
                <X size={18} aria-hidden="true" />
              </button>
              <span>Saved</span>
              <h2 id="admin-success-title">{inviteSuccessMessage}</h2>
              <p>The email was added to the staff invite list in Supabase.</p>
            </section>
          </div>
        )}
        {isAddAdminOpen && (
          <div className="admin-alert-backdrop" role="presentation">
            <section className="admin-alert admin-form-modal" role="dialog" aria-modal="true" aria-labelledby="add-admin-title">
              <button
                className="service-modal-close"
                type="button"
                aria-label="Close add admin"
                onClick={() => setIsAddAdminOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
              <span>New Staff</span>
              <h2 id="add-admin-title">Add a new staff email.</h2>
              <form className="invite-form modal" onSubmit={createStaffInvite}>
                <input name="invite_name" type="text" placeholder="Name" />
                <input name="invite_email" type="email" placeholder="staff@company.com" required />
                <select name="invite_role" defaultValue="manager" aria-label="Staff role">
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" disabled={status === "saving"}>
                  {status === "saving" ? "Adding..." : "Add new staff"}
                </button>
              </form>
            </section>
          </div>
        )}
        <div className="admin-head">
          <div>
            <span>Admin request desk</span>
            <h1>Service requests ready for delivery.</h1>
            <p>Requests are fetched from Supabase and can be claimed by the manager who starts delivery.</p>
          </div>
          <button className="admin-refresh" type="button" onClick={fetchRequests} disabled={status === "loading"}>
            <RefreshCw size={17} aria-hidden="true" />
            {status === "loading" ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="admin-stats" aria-label="Request summary">
          <span>
            <strong>{stats.new}</strong>
            New
          </span>
          <span>
            <strong>{stats.active}</strong>
            In process
          </span>
          <span>
            <strong>{stats.done}</strong>
            Delivered
          </span>
        </div>

        {message && <p className={`form-message ${status}`}>{message}</p>}

        {isAdmin && (
          <section className="role-management" aria-label="Agency role management">
            <div className="role-management-head">
              <span>
                <Users size={17} aria-hidden="true" />
                Admin table
              </span>
              <div className="role-management-actions">
                <strong>{staffRows.length} staff</strong>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateEmail(null);
                    setInviteSuccessMessage("");
                    setIsAddAdminOpen(true);
                  }}
                >
                  Add new staff
                </button>
              </div>
            </div>
            {invites.length > 0 && (
              <div className="invite-list" aria-label="Pending and accepted agency invites">
                {invites.map((invite) => (
                  <span key={invite.id}>
                    <strong>{invite.email}</strong>
                    {invite.role}
                    {invite.accepted_at ? "Accepted" : "Invited"}
                  </span>
                ))}
              </div>
            )}
            <div className="admin-profile-table-wrap">
              <table className="admin-profile-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Role</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((profile) => {
                    const isProtectedOwner = isTestingOwnerEmail(profile.email);
                    const isCurrentUser = profile.kind === "profile" && profile.id === user?.id;

                    return (
                      <tr key={`${profile.kind}-${profile.id}`}>
                        <td>{profile.kind === "profile" ? profile.id : "Pending invite"}</td>
                        <td>{profile.name || "Invited staff"}</td>
                        <td>{profile.email}</td>
                        <td>{profile.created_at ? formatDate(profile.created_at) : "Not available"}</td>
                        <td>
                          {profile.kind === "profile" ? (
                            <select
                              value={profile.role}
                              disabled={status === "saving" || isProtectedOwner}
                              onChange={(event) => updateProfileRole(profile.id, event.target.value as ProfileSummary["role"])}
                              aria-label={`Change ${profile.name} role`}
                              title={isProtectedOwner ? "Testing owner ID is protected" : "Change staff role"}
                            >
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="pending-role">{profile.role}</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="staff-delete-button"
                            type="button"
                            onClick={() => removeStaffRow(profile)}
                            disabled={status === "saving" || isCurrentUser || isProtectedOwner}
                            aria-label={`Remove ${profile.email} from staff table`}
                            title={
                              isProtectedOwner
                                ? "Testing owner ID is protected"
                                : isCurrentUser
                                  ? "You cannot remove your own access"
                                  : "Remove staff access"
                            }
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="request-board">
          {requests.length === 0 && status !== "loading" ? (
            <p className="admin-empty">No service requests yet.</p>
          ) : (
            requests.map((request) => {
              const requester = request.user_id ? profiles[request.user_id] : null;
              const owner = request.claimed_by ? profiles[request.claimed_by] : null;
              return (
                <article className="request-ticket" key={request.id}>
                  <div className="ticket-top">
                    <div>
                      <span className={`status-pill ${request.status}`}>{statusLabel[request.status] || request.status}</span>
                      <h2>{request.service_title || request.project_type}</h2>
                    </div>
                    <time dateTime={request.created_at}>{formatDate(request.created_at)}</time>
                  </div>

                  <dl className="ticket-details">
                    <div>
                      <dt>Requested by</dt>
                      <dd>{request.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{request.email || requester?.email || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt>Account type</dt>
                      <dd>{requester?.role === "member" ? "Regular user" : requester?.role || "Regular user"}</dd>
                    </div>
                    <div>
                      <dt>Initiative owner</dt>
                      <dd>{owner ? `${owner.name} (${owner.role})` : "Not assigned yet"}</dd>
                    </div>
                  </dl>

                  {(request.service_info || request.requirements || request.message) && (
                    <div className="ticket-copy">
                      {request.service_info && (
                        <>
                          <h3>Service info</h3>
                          <p>{request.service_info}</p>
                        </>
                      )}
                      {(request.requirements || request.message) && (
                        <>
                          <h3>Requirements</h3>
                          <p>{request.requirements || request.message}</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="ticket-actions">
                    <button
                      type="button"
                      onClick={() => updateRequest(request.id, "in_process")}
                      disabled={status === "saving" || request.status === "in_process"}
                    >
                      <UserCheck size={16} aria-hidden="true" />
                      Mark in process
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRequest(request.id, "delivered")}
                      disabled={status === "saving" || request.status === "delivered"}
                    >
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Mark delivered
                    </button>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => deleteRequest(request.id)}
                      disabled={status === "saving"}
                    >
                      <X size={16} aria-hidden="true" />
                      Delete request
                    </button>
                    {request.claimed_at && (
                      <span>
                        <Clock3 size={15} aria-hidden="true" />
                        Claimed {formatDate(request.claimed_at)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
