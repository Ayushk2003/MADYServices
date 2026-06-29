import { useEffect, useState } from "react";
import {
  Bell,
  Blocks,
  ChevronLeft,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  PhoneCall,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useAuthGate } from "./AuthGate";
import { allowAdminPageEntry, isAdminUser } from "../access";
import { navItems } from "../data/siteContent";
import { supabase } from "../supabaseClient";
import {
  clearPortalNotifications,
  markPortalNotificationsRead,
  PORTAL_NOTIFICATION_EVENT,
  pushPortalNotification,
  readPortalNotifications,
  type PortalNotification,
} from "../notifications";

type AcceptedInviteNotification = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "manager";
  accepted_at: string | null;
};

const navHrefFor = (item: string) => (item === "Career" ? "/career" : `/#${item.toLowerCase()}`);

const formatNotificationDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function Header() {
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, openAuth, logout } = useAuthGate();
  const notificationOwnerId = user?.id || null;
  const [notifications, setNotifications] = useState<PortalNotification[]>(() => readPortalNotifications(notificationOwnerId));
  const closeMenu = () => {
    setIsProfileSidebarOpen(false);
    setIsNotificationsOpen(false);
  };
  const openProfileNavigation = () => {
    setIsNotificationsOpen(false);

    if (window.matchMedia("(max-width: 1050px)").matches) {
      setIsProfileMenuOpen((current) => !current);
      return;
    }

    setIsProfileMenuOpen(false);
    setIsProfileSidebarOpen(true);
  };
  const openPortal = (target: "/admin" | "/manager") => {
    allowAdminPageEntry();
    window.location.href = target;
  };
  const openRestrictedStaffPage = (target: "/placards") => {
    allowAdminPageEntry();
    window.location.href = target;
  };
  const isAdmin = isAdminUser(user);
  const isManager = user?.role === "manager";
  const canSeeNotifications = Boolean(user && (isAdmin || isManager));
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    setNotifications(readPortalNotifications(notificationOwnerId));
  }, [notificationOwnerId]);

  useEffect(() => {
    const handleNotificationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<PortalNotification[]>;
      setNotifications(Array.isArray(customEvent.detail) ? customEvent.detail : readPortalNotifications(notificationOwnerId));
    };
    const handleStorageUpdate = () => setNotifications(readPortalNotifications(notificationOwnerId));

    window.addEventListener(PORTAL_NOTIFICATION_EVENT, handleNotificationUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(PORTAL_NOTIFICATION_EVENT, handleNotificationUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [notificationOwnerId]);

  useEffect(() => {
    if (!supabase || !isAdmin) return;

    let isMounted = true;
    const client = supabase;

    const loadAcceptedInvites = async () => {
      const { data, error } = await client
        .from("agency_invites")
        .select("id,email,name,role,accepted_at")
        .not("accepted_at", "is", null)
        .order("accepted_at", { ascending: false })
        .limit(10);

      if (error || !isMounted) return;

      (data as AcceptedInviteNotification[] | null)?.forEach((invite) => {
        if (!invite.accepted_at) return;

        const joinedRole = invite.role === "admin" ? "Admin" : "Manager";
        pushPortalNotification(
          `${joinedRole} invite accepted`,
          `${invite.name || invite.email} joined as ${joinedRole}.`,
          `invite-joined:${invite.id}:${invite.accepted_at}`,
          notificationOwnerId,
        );
      });
    };

    void loadAcceptedInvites();
    const intervalId = window.setInterval(loadAcceptedInvites, 45000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAdmin, notificationOwnerId]);

  return (
    <>
      <header className="site-header">
        <a className="brand-mark" href="/" aria-label="MADY home" onClick={closeMenu}>
          <img className="brand-logo" src="/mady-logo.png" alt="" />
          <span>MADY</span>
        </a>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item} href={navHrefFor(item)}>
              {item}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <div className="profile-menu-wrap">
            <button
              className="profile-icon-button"
              type="button"
              aria-label="Open profile navigation"
              aria-expanded={isProfileMenuOpen || isProfileSidebarOpen}
              aria-controls={isProfileMenuOpen ? undefined : "profile-sidebar"}
              onClick={openProfileNavigation}
            >
              <User size={19} aria-hidden="true" />
            </button>
            {isProfileMenuOpen && (
              <div className="profile-menu" role="menu">
                {user ? (
                  <>
                    <a href="/profile" role="menuitem" onClick={() => setIsProfileMenuOpen(false)}>
                      <User size={16} aria-hidden="true" />
                      Go to profile
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          openPortal("/admin");
                        }}
                      >
                        <ShieldCheck size={16} aria-hidden="true" />
                        Admin portal
                      </button>
                    )}
                    {(isAdmin || isManager) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          openPortal("/manager");
                        }}
                      >
                        <ShieldCheck size={16} aria-hidden="true" />
                        Manager portal
                      </button>
                    )}
                    {(isAdmin || isManager) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          openRestrictedStaffPage("/placards");
                        }}
                      >
                        <Blocks size={16} aria-hidden="true" />
                        Service placards
                      </button>
                    )}
                    <button
                      className="logout-action"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void logout();
                        setIsProfileMenuOpen(false);
                      }}
                    >
                      <LogOut size={16} aria-hidden="true" />
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openAuth("login");
                        setIsProfileMenuOpen(false);
                      }}
                    >
                      <LogIn size={16} aria-hidden="true" />
                      Login
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openAuth("register");
                        setIsProfileMenuOpen(false);
                      }}
                    >
                      <UserPlus size={16} aria-hidden="true" />
                      Register
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {canSeeNotifications && (
            <div className="header-notification-wrap">
              <button
                className={`header-notification-button${unreadCount > 0 ? " is-unread" : ""}`}
                type="button"
                aria-label="Open admin notifications"
                aria-expanded={isNotificationsOpen}
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsProfileSidebarOpen(false);
                  setIsNotificationsOpen((current) => {
                    const nextIsOpen = !current;
                    if (nextIsOpen) {
                      setNotifications(markPortalNotificationsRead(notificationOwnerId));
                    }
                    return nextIsOpen;
                  });
                }}
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && <span>{unreadCount}</span>}
              </button>
              {isNotificationsOpen && (
                <div className="header-notification-panel" role="status" aria-live="polite">
                  <div className="notification-panel-head">
                    <strong>Notifications</strong>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          clearPortalNotifications(notificationOwnerId);
                          setNotifications([]);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p>No notifications yet.</p>
                  ) : (
                    notifications.map((notification) => (
                      <article key={notification.id} className={notification.readAt ? undefined : "is-unread"}>
                        <h3>{notification.title}</h3>
                        <p>{notification.detail}</p>
                        <time dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time>
                      </article>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div
        className={`sidebar-backdrop${isProfileSidebarOpen ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={closeMenu}
      />
      <aside
        id="profile-sidebar"
        className={`mobile-sidebar profile-sidebar${isProfileSidebarOpen ? " is-open" : ""}`}
        aria-label="Profile navigation"
        aria-hidden={!isProfileSidebarOpen}
      >
        <div className="sidebar-head">
          <a className="brand-mark" href="/" aria-label="MADY home" onClick={closeMenu}>
            <img className="brand-logo" src="/mady-logo.png" alt="" />
            <span>MADY</span>
          </a>
          <button className="sidebar-close" type="button" aria-label="Close menu" onClick={closeMenu}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {user ? (
          <div className="sidebar-actions authenticated">
            <span>{user.name.split(" ")[0]}</span>
            <a className="sidebar-login" href="/profile" onClick={closeMenu}>
              <User size={18} aria-hidden="true" />
              Profile
            </a>
            {isAdmin && (
              <button
                className="sidebar-login"
                type="button"
                onClick={() => {
                  closeMenu();
                  openPortal("/admin");
                }}
              >
                <ShieldCheck size={18} aria-hidden="true" />
                Admin portal
              </button>
            )}
            {(isAdmin || isManager) && (
              <button
                className="sidebar-login"
                type="button"
                onClick={() => {
                  closeMenu();
                  openPortal("/manager");
                }}
              >
                <ShieldCheck size={18} aria-hidden="true" />
                Manager portal
              </button>
            )}
            {(isAdmin || isManager) && (
              <button
                className="sidebar-login"
                type="button"
                onClick={() => {
                  closeMenu();
                  openRestrictedStaffPage("/placards");
                }}
              >
                <Blocks size={18} aria-hidden="true" />
                Service placards
              </button>
            )}
            <button
              className="sidebar-login logout-action"
              type="button"
              onClick={() => {
                void logout();
                closeMenu();
              }}
            >
              <LogOut size={18} aria-hidden="true" />
              Logout
            </button>
          </div>
        ) : (
          <div className="sidebar-actions">
            <button
              className="sidebar-login"
              type="button"
              onClick={() => {
                openAuth("login");
                closeMenu();
              }}
            >
              <LogIn size={18} aria-hidden="true" />
              Login
            </button>
            <button
              className="sidebar-register"
              type="button"
              onClick={() => {
                openAuth("register");
                closeMenu();
              }}
            >
              <UserPlus size={18} aria-hidden="true" />
              Register
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export function PageBackButton() {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "/";
  };

  return (
    <button className="page-back-button" type="button" onClick={goBack}>
      <ChevronLeft size={18} aria-hidden="true" />
      Back
    </button>
  );
}

export function WhatsAppButton() {
  return (
    <a
      className="whatsapp-float"
      href="https://wa.me/919118290033"
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with MADY labs on WhatsApp"
    >
      <MessageCircle size={24} aria-hidden="true" />
    </a>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <a className="brand-mark" href="/" aria-label="MADY home">
          <img className="brand-logo" src="/mady-logo.png" alt="" />
          <span>MADY</span>
        </a>
        <p>
          MADY labs builds interactive websites, campaign systems, creative content,
          automation, and performance funnels for brands that want measurable growth.
        </p>
      </div>
      <div className="footer-columns">
        <div>
          <h3>Services</h3>
          <a href="/#services">3D websites</a>
          <a href="/#services">Performance marketing</a>
          <a href="/#services">Content studio</a>
          <a href="/#services">Automation systems</a>
        </div>
        <div>
          <h3>Company</h3>
          <a href="/#work">Case studies</a>
          <a href="/#process">Process</a>
          <a href="/career">Careers</a>
          <a href="/#contact">Contact</a>
        </div>
        <div>
          <h3>Contact</h3>
          <span>
            <Mail size={15} aria-hidden="true" />
            hello@madymedia.agency
          </span>
          <span>
            <PhoneCall size={15} aria-hidden="true" />
            +91 91182 90033
          </span>
          <span>
            <MapPin size={15} aria-hidden="true" />
            Digital-first agency
          </span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>Copyright {year} MADY labs. All rights reserved.</span>
        <span>Privacy · Terms · Accessibility</span>
      </div>
    </footer>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="section-title reveal-up">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
