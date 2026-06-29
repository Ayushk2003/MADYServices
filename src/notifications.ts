export type PortalNotification = {
  id: number;
  title: string;
  detail: string;
  createdAt: string;
  readAt?: string;
  sourceKey?: string;
};

const STORAGE_KEY = "mady-portal-notifications";
const DISMISSED_STORAGE_KEY = "mady-portal-dismissed-notifications";

export const PORTAL_NOTIFICATION_EVENT = "mady-portal-notification";

const scopedKey = (baseKey: string, ownerId?: string | null) => `${baseKey}:${ownerId || "guest"}`;

const readDismissedSourceKeys = (ownerId?: string | null): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(scopedKey(DISMISSED_STORAGE_KEY, ownerId));
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
};

const writeDismissedSourceKeys = (sourceKeys: string[], ownerId?: string | null) => {
  window.localStorage.setItem(scopedKey(DISMISSED_STORAGE_KEY, ownerId), JSON.stringify(sourceKeys));
};

export const readPortalNotifications = (ownerId?: string | null): PortalNotification[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(scopedKey(STORAGE_KEY, ownerId));
    return stored ? (JSON.parse(stored) as PortalNotification[]) : [];
  } catch {
    return [];
  }
};

const writePortalNotifications = (notifications: PortalNotification[], ownerId?: string | null) => {
  window.localStorage.setItem(scopedKey(STORAGE_KEY, ownerId), JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(PORTAL_NOTIFICATION_EVENT, { detail: notifications }));
};

export const pushPortalNotification = (title: string, detail: string, sourceKey?: string, ownerId?: string | null) => {
  if (typeof window === "undefined") return [];

  const currentNotifications = readPortalNotifications(ownerId);
  const dismissedSourceKeys = readDismissedSourceKeys(ownerId);

  if (
    sourceKey &&
    (dismissedSourceKeys.includes(sourceKey) || currentNotifications.some((notification) => notification.sourceKey === sourceKey))
  ) {
    return currentNotifications;
  }

  const nextNotifications = [
    {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      detail,
      createdAt: new Date().toISOString(),
      sourceKey,
    },
    ...currentNotifications,
  ].slice(0, 20);

  writePortalNotifications(nextNotifications, ownerId);
  return nextNotifications;
};

export const markPortalNotificationsRead = (ownerId?: string | null) => {
  if (typeof window === "undefined") return [];

  const readAt = new Date().toISOString();
  const nextNotifications = readPortalNotifications(ownerId).map((notification) => ({
    ...notification,
    readAt: notification.readAt || readAt,
  }));

  writePortalNotifications(nextNotifications, ownerId);
  return nextNotifications;
};

export const clearPortalNotifications = (ownerId?: string | null) => {
  if (typeof window === "undefined") return;

  const sourceKeysToDismiss = readPortalNotifications(ownerId)
    .map((notification) => notification.sourceKey)
    .filter(Boolean) as string[];
  const dismissedSourceKeys = new Set([...readDismissedSourceKeys(ownerId), ...sourceKeysToDismiss]);

  writeDismissedSourceKeys([...dismissedSourceKeys], ownerId);
  window.localStorage.removeItem(scopedKey(STORAGE_KEY, ownerId));
  window.dispatchEvent(new CustomEvent(PORTAL_NOTIFICATION_EVENT, { detail: [] }));
};
