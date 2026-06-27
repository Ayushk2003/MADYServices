import { useState, type MouseEvent } from "react";
import { ArrowUpRight, LogIn, Mail, MapPin, Menu, MessageCircle, PhoneCall, UserPlus, X } from "lucide-react";
import { useAuthGate } from "./AuthGate";
import { navItems } from "../data/siteContent";

const navHrefFor = (item: string) => (item === "Career" ? "/career" : `/#${item.toLowerCase()}`);

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, requireAuth, openAuth, logout } = useAuthGate();
  const closeMenu = () => setIsMenuOpen(false);
  const guardContact = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!requireAuth("send a service request")) {
      event.preventDefault();
    }
  };

  return (
    <>
      <header className="site-header">
        <button
          className="menu-toggle"
          type="button"
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-sidebar"
          onClick={() => setIsMenuOpen(true)}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
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
          {user ? (
            <button className="auth-nav-button" type="button" onClick={logout}>
              {user.name.split(" ")[0]}
            </button>
          ) : (
            <>
              <button className="auth-nav-button" type="button" onClick={() => openAuth("login")}>
                <LogIn size={16} aria-hidden="true" />
                Login
              </button>
              <button className="auth-nav-button register" type="button" onClick={() => openAuth("register")}>
                <UserPlus size={16} aria-hidden="true" />
                Register
              </button>
            </>
          )}
          <a className="header-cta" href="/#contact" onClick={guardContact}>
            Start Project
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      <div
        className={`sidebar-backdrop${isMenuOpen ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={closeMenu}
      />
      <aside
        id="mobile-sidebar"
        className={`mobile-sidebar${isMenuOpen ? " is-open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!isMenuOpen}
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
        <div className="sidebar-links">
          {navItems.map((item) => (
            <a key={item} href={navHrefFor(item)} onClick={closeMenu}>
              {item}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ))}
        </div>
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
      </aside>
    </>
  );
}

export function WhatsAppButton() {
  return (
    <a
      className="whatsapp-float"
      href="https://wa.me/919118290033"
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with MADY Media on WhatsApp"
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
          MADY Media builds interactive websites, campaign systems, creative content,
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
        <span>Copyright {year} MADY Media and Company. All rights reserved.</span>
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
