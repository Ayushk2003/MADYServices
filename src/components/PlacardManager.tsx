import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, RefreshCw, ShieldCheck, X } from "lucide-react";
import { canAccessAgencyPortal, hasAllowedAdminPageEntry } from "../access";
import {
  defaultServicePlacards,
  hydrateServicePlacards,
  placardColumns,
} from "../hooks/usePlacards";
import { LoadingButtonLabel, LoadingState } from "../loading";
import { supabase } from "../supabaseClient";
import {
  serviceIconMap,
  serviceIconOptions,
  type ServiceIconKey,
  type ServicePlacard,
} from "../data/siteContent";
import { useAuthGate } from "./AuthGate";

type ServicePlacardForm = {
  id?: string;
  title: string;
  eyebrow: string;
  description: string;
  icon_key: ServiceIconKey;
  points: string;
  is_active: boolean;
};

type StoredServicePlacard = Omit<ServicePlacard, "icon">;

const emptyForm: ServicePlacardForm = {
  title: "",
  eyebrow: "",
  description: "",
  icon_key: "website",
  points: "",
  is_active: true,
};

const isDefaultPlacard = (id: string) => id.startsWith("default-service-");

const formFromPlacard = (placard: ServicePlacard): ServicePlacardForm => ({
  id: placard.id,
  title: placard.title,
  eyebrow: placard.eyebrow,
  description: placard.description,
  icon_key: placard.icon_key,
  points: placard.points.join("\n"),
  is_active: placard.is_active,
});

const pointsFromText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 6);

export function PlacardManager() {
  const { user, isAuthReady, openAuth } = useAuthGate();
  const [hasStaffEntry] = useState(() => hasAllowedAdminPageEntry());
  const [placards, setPlacards] = useState<ServicePlacard[]>([]);
  const [form, setForm] = useState<ServicePlacardForm>(emptyForm);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const canManagePlacards = canAccessAgencyPortal(user);
  const activeCount = useMemo(() => placards.filter((placard) => placard.is_active).length, [placards]);
  const sortedPlacards = useMemo(
    () => [...placards].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
    [placards],
  );

  const showToast = (nextMessage: string) => {
    setToastMessage(nextMessage);
    window.setTimeout(() => setToastMessage(""), 3200);
  };

  const loadPlacards = async () => {
    if (!supabase || !canManagePlacards) {
      setPlacards(defaultServicePlacards);
      return;
    }

    setStatus("loading");
    setMessage("");

    const { data, error } = await supabase
      .from("service_placards")
      .select(placardColumns)
      .order("sort_order", { ascending: true });

    if (error) {
      setPlacards(defaultServicePlacards);
      setStatus("error");
      setMessage("Service placard storage is not ready. Apply the latest supabase/schema.sql, then refresh this page.");
      return;
    }

    setPlacards(data && data.length > 0 ? hydrateServicePlacards(data as StoredServicePlacard[]) : defaultServicePlacards);
    setStatus("idle");
  };

  useEffect(() => {
    if (canManagePlacards) {
      void loadPlacards();
    }
  }, [canManagePlacards]);

  const resetForm = () => {
    setForm(emptyForm);
    setMessage("");
  };

  const savePlacard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !canManagePlacards) {
      setStatus("error");
      setMessage("Live service placard storage is not configured yet.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      eyebrow: form.eyebrow.trim(),
      description: form.description.trim(),
      icon_key: form.icon_key,
      points: pointsFromText(form.points),
      is_active: form.is_active,
    };

    if (!payload.title || !payload.eyebrow || !payload.description || payload.points.length === 0) {
      setStatus("error");
      setMessage("Fill in the title, eyebrow, description, and at least one bullet point.");
      return;
    }

    setStatus("saving");
    setMessage("");

    const isEditingSavedPlacard = form.id && !isDefaultPlacard(form.id);
    const request = isEditingSavedPlacard
      ? supabase
          .from("service_placards")
          .update(payload)
          .eq("id", form.id)
          .select(placardColumns)
          .single()
      : supabase
          .from("service_placards")
          .insert({
            ...payload,
            sort_order: placards.length + 1,
          })
          .select(placardColumns)
          .single();

    const { data, error } = await request;

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (data) {
      const [savedPlacard] = hydrateServicePlacards([data as StoredServicePlacard]);
      setPlacards((current) => {
        const withoutSaved = current.filter((placard) => placard.id !== savedPlacard.id && placard.id !== form.id);
        return [...withoutSaved, savedPlacard];
      });
    }

    resetForm();
    setStatus("success");
    showToast(form.id ? "Service placard updated." : "Service placard added.");
    await loadPlacards();
  };

  const togglePlacard = async (placard: ServicePlacard) => {
    if (!supabase || !canManagePlacards || isDefaultPlacard(placard.id)) {
      setStatus("error");
      setMessage(
        isDefaultPlacard(placard.id)
          ? "Apply the latest schema so the default service placards are seeded before toggling this card."
          : "Live service placard storage is not configured yet.",
      );
      return;
    }

    setStatus("saving");
    setMessage("");

    const { error } = await supabase
      .from("service_placards")
      .update({ is_active: !placard.is_active })
      .eq("id", placard.id);

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setPlacards((current) =>
      current.map((item) => (item.id === placard.id ? { ...item, is_active: !item.is_active } : item)),
    );
    setStatus("idle");
    showToast(placard.is_active ? "Service placard hidden." : "Service placard published.");
  };

  const removePlacard = async (placard: ServicePlacard) => {
    if (!supabase || !canManagePlacards || isDefaultPlacard(placard.id)) {
      setStatus("error");
      setMessage(
        isDefaultPlacard(placard.id)
          ? "Apply the latest schema so the default service placards are seeded before deleting this card."
          : "Live service placard storage is not configured yet.",
      );
      return;
    }

    setStatus("saving");
    setMessage("");

    const { data, error } = await supabase.from("service_placards").delete().eq("id", placard.id).select("id");

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setStatus("error");
      setMessage("Service placard was not deleted. Apply the latest Supabase delete policy, then try again.");
      return;
    }

    setPlacards((current) => current.filter((item) => item.id !== placard.id));
    if (form.id === placard.id) {
      resetForm();
    }
    setStatus("idle");
    showToast("Service placard removed.");
  };

  if (!isAuthReady) {
    return (
      <main>
        <section className="admin-page">
          <LoadingState label="Checking access" detail="Verifying your MADY labs session." />
        </section>
      </main>
    );
  }

  if (!hasStaffEntry) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Restricted staff page</span>
          <h1>Staff access must start from the profile menu.</h1>
          <p>Direct URL access to this page is blocked. Open Service placards from your staff profile menu.</p>
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
          <span>Service placards</span>
          <h1>Login before editing service placards.</h1>
          <p>Only MADY labs managers and admins can add, remove, publish, or edit Request service placards.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => openAuth("login", "manage service placards")}>
              Login
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!canManagePlacards) {
    return (
      <main>
        <section className="admin-page admin-gate">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Manager and admin only</span>
          <h1>This page is only for agency staff.</h1>
          <p>Your account is registered as a member. Ask an admin to promote your profile before managing service placards.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="admin-page placard-page">
        {toastMessage && (
          <div className="admin-toast" role="status" aria-live="polite">
            {toastMessage}
          </div>
        )}
        <div className="admin-head">
          <div>
            <span>Service placards</span>
            <h1>Manage Request service cards.</h1>
            <p>Add new service placards, update the copy, change icons, hide cards from the website, or remove old ones.</p>
          </div>
          <div className="admin-head-actions">
            <button className="admin-refresh" type="button" onClick={loadPlacards} disabled={status === "loading"}>
              <RefreshCw size={17} aria-hidden="true" />
              {status === "loading" ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="admin-stats placard-stats" aria-label="Service placard summary">
          <span>
            <strong>{placards.length}</strong>
            Total cards
          </span>
          <span>
            <strong>{activeCount}</strong>
            Published
          </span>
          <span>
            <strong>{placards.length - activeCount}</strong>
            Hidden
          </span>
        </div>

        {status === "loading" && (
          <LoadingState label="Loading service placards" detail="Fetching the managed Request service cards." variant="inline" />
        )}

        {message && <p className={`form-message ${status}`}>{message}</p>}

        <div className="placard-layout">
          <form className="placard-form" onSubmit={savePlacard}>
            <div className="role-management-head">
              <span>{form.id ? "Edit service card" : "New service card"}</span>
              {form.id && (
                <button className="placard-secondary-action" type="button" onClick={resetForm}>
                  <X size={16} aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Website Experiences"
                maxLength={80}
                required
              />
            </label>
            <label>
              Eyebrow
              <input
                type="text"
                value={form.eyebrow}
                onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))}
                placeholder="3D + motion"
                maxLength={60}
                required
              />
            </label>
            <label>
              Icon
              <select
                value={form.icon_key}
                onChange={(event) => setForm((current) => ({ ...current, icon_key: event.target.value as ServiceIconKey }))}
              >
                {serviceIconOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe the service and what users can request."
                maxLength={260}
                required
              />
            </label>
            <label>
              Bullet points
              <textarea
                value={form.points}
                onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))}
                placeholder={"3D hero systems\nScroll-led storytelling\nConversion-first UX"}
                maxLength={360}
                required
              />
            </label>
            <label className="placard-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              />
              Publish on website
            </label>
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? (
                <LoadingButtonLabel>Saving</LoadingButtonLabel>
              ) : (
                <>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {form.id ? "Save changes" : "Add service card"}
                </>
              )}
            </button>
          </form>

          <div className="placard-list" aria-label="Editable service placards">
            {sortedPlacards.map((placard) => {
              const PreviewIcon = serviceIconMap[placard.icon_key] || serviceIconMap.website;

              return (
                <article className="placard-edit-card" key={placard.id}>
                  <div>
                    <span className={`status-pill ${placard.is_active ? "accepted" : "closed"}`}>
                      {placard.is_active ? "Published" : "Hidden"}
                    </span>
                    <h2>
                      <PreviewIcon size={20} aria-hidden="true" />
                      {placard.title}
                    </h2>
                    <p>{placard.eyebrow}</p>
                  </div>
                  <p>{placard.description}</p>
                  <ul>
                    {placard.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <div className="placard-actions">
                    <button type="button" onClick={() => setForm(formFromPlacard(placard))}>
                      Edit
                    </button>
                    <button type="button" onClick={() => togglePlacard(placard)} disabled={status === "saving"}>
                      {placard.is_active ? "Hide" : "Publish"}
                    </button>
                    <button
                      className="placard-danger-action"
                      type="button"
                      onClick={() => removePlacard(placard)}
                      disabled={status === "saving"}
                    >
                      <X size={16} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
