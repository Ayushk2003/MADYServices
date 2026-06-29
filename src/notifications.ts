export type PortalNotification = {
  id: number;
  title: string;
  detail: string;
  createdAt: string;
  readAt?: string;
  sourceKey?: string;
};

const STORAGE_KEY = "mady-portal-notifications";

export const PORTAL_NOTIFICATION_EVENT = "mady-portal-notification";

export const readPortalNotifications = (): PortalNotification[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PortalNotification[]) : [];
  } catch {
    return [];
  }
};

const writePortalNotifications = (notifications: PortalNotification[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(PORTAL_NOTIFICATION_EVENT, { detail: notifications }));
};

export const pushPortalNotification = (title: string, detail: string, sourceKey?: string) => {
  if (typeof window === "undefined") return [];

  const currentNotifications = readPortalNotifications();

  if (sourceKey && currentNotifications.some((notification) => notification.sourceKey === sourceKey)) {
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

  writePortalNotifications(nextNotifications);
  return nextNotifications;
};

export const markPortalNotificationsRead = () => {
  if (typeof window === "undefined") return [];

  const readAt = new Date().toISOString();
  const nextNotifications = readPortalNotifications().map((notification) => ({
    ...notification,
    readAt: notification.readAt || readAt,
  }));

  writePortalNotifications(nextNotifications);
  return nextNotifications;
};

export const clearPortalNotifications = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PORTAL_NOTIFICATION_EVENT, { detail: [] }));
};
