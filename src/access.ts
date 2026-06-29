import type { AppUser } from "./supabaseClient";

export const TESTING_OWNER_EMAIL = "ayushkushwaha182003@gmail.com";

export const isTestingOwnerEmail = (email?: string | null) =>
  (email || "").trim().toLowerCase() === TESTING_OWNER_EMAIL;

export const isTestingOwner = (user?: AppUser | null) => isTestingOwnerEmail(user?.email);

export const isAdminUser = (user?: AppUser | null) =>
  Boolean(user && (user.role === "admin" || isTestingOwner(user)));

export const canUsePublicUserActions = (user?: AppUser | null) =>
  Boolean(user && (user.role === "member" || isAdminUser(user)));

export const canCreateServiceRequest = canUsePublicUserActions;

export const canAccessAgencyPortal = (user?: AppUser | null) =>
  Boolean(user && (isAdminUser(user) || user.role === "manager"));

const ADMIN_ENTRY_KEY = "mady-admin-entry";

export const allowAdminPageEntry = () => {
  try {
    window.sessionStorage.setItem(ADMIN_ENTRY_KEY, "allowed");
  } catch {
    // Storage can be unavailable in strict browser modes; access still relies on role checks.
  }
};

export const hasAllowedAdminPageEntry = () => {
  try {
    return window.sessionStorage.getItem(ADMIN_ENTRY_KEY) === "allowed";
  } catch {
    return false;
  }
};
