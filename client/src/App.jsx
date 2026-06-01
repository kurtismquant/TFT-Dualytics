import { useRef, useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CompPage from "./pages/CompPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import CompBuilderPage from "./pages/CompBuilderPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import MatchHistoryPage from "./pages/MatchHistoryPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import TermsOfService from "./pages/TermsOfService.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import styles from "./App.module.css";
import { Link } from "react-router-dom";
import { ROUTES } from "./constants/routes.js";
import NavSearchBar from "./components/NavSearchBar.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { useFocusTrap } from "./hooks/useFocusTrap.js";

function GearIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.67 3.35c.55-1.8 3.11-1.8 3.66 0l.18.58a1.9 1.9 0 0 0 2.7 1.12l.54-.28c1.66-.88 3.47.93 2.59 2.59l-.28.54a1.9 1.9 0 0 0 1.12 2.7l.58.18c1.8.55 1.8 3.11 0 3.66l-.58.18a1.9 1.9 0 0 0-1.12 2.7l.28.54c.88 1.66-.93 3.47-2.59 2.59l-.54-.28a1.9 1.9 0 0 0-2.7 1.12l-.18.58c-.55 1.8-3.11 1.8-3.66 0l-.18-.58a1.9 1.9 0 0 0-2.7-1.12l-.54.28c-1.66.88-3.47-.93-2.59-2.59l.28-.54a1.9 1.9 0 0 0-1.12-2.7l-.58-.18c-1.8-.55-1.8-3.11 0-3.66l.58-.18a1.9 1.9 0 0 0 1.12-2.7l-.28-.54C2.78 5.7 4.59 3.89 6.25 4.77l.54.28a1.9 1.9 0 0 0 2.7-1.12l.18-.58Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hamburgerRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const { t } = useTranslation();
  const location = useLocation();
  const isHomePage = location.pathname === ROUTES.home;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  useFocusTrap({
    active: menuOpen,
    rootRef: mobileMenuRef,
    returnFocusRef: hamburgerRef,
    onEscape: () => setMenuOpen(false),
  });

  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main-content">
        {t("nav.skipToMain")}
      </a>
      <nav className={styles.nav}>
        <button
          ref={hamburgerRef}
          type="button"
          className={styles.hamburger}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
        >
          <span
            className={`${styles.hamburgerBar} ${menuOpen ? styles.barTop : ""}`}
          />
          <span
            className={`${styles.hamburgerBar} ${menuOpen ? styles.barMid : ""}`}
          />
          <span
            className={`${styles.hamburgerBar} ${menuOpen ? styles.barBot : ""}`}
          />
        </button>

        <div
          className={`${styles.backdrop} ${menuOpen ? styles.backdropOpen : ""}`}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />

        <div
          id="primary-navigation"
          ref={mobileMenuRef}
          className={`${styles.links} ${menuOpen ? styles.linksOpen : ""}`}
        >
          <NavLink
            to={ROUTES.comps}
            className={({ isActive }) =>
              isActive ? styles.activeLink : styles.link
            }
            onClick={() => setMenuOpen(false)}
          >
            {t("nav.comps")}
          </NavLink>

          <NavLink
            to={ROUTES.stats}
            className={({ isActive }) =>
              isActive ? styles.activeLink : styles.link
            }
            onClick={() => setMenuOpen(false)}
          >
            {t("nav.stats")}
          </NavLink>

          <NavLink
            to={ROUTES.builder}
            className={({ isActive }) =>
              isActive ? styles.activeLink : styles.link
            }
            onClick={() => setMenuOpen(false)}
          >
            {t("nav.teamBuilder")}
          </NavLink>

          <NavLink
            to={ROUTES.leaderboard}
            className={({ isActive }) =>
              isActive ? styles.activeLink : styles.link
            }
            onClick={() => setMenuOpen(false)}
          >
            {t("nav.leaderboard")}
          </NavLink>

          <button
            type="button"
            className={styles.gearBtnDrawer}
            onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}
            aria-label={t("settings.title")}
          >
            <GearIcon />
            <span>{t("settings.title")}</span>
          </button>
        </div>

        <Link to={ROUTES.home} className={styles.logoLink}>
          <span className={styles.logo}>
            TFT <span className={styles.duGold}>DU</span>alytics
          </span>
        </Link>

        <div className={styles.navRight}>
          {!isHomePage && (
            <div className={styles.navSearch}>
              <NavSearchBar />
            </div>
          )}
          <button
            type="button"
            className={styles.gearBtn}
            onClick={() => setSettingsOpen(true)}
            aria-label={t("settings.title")}
          >
            <GearIcon />
          </button>
        </div>
      </nav>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <main id="main-content" className={styles.page} tabIndex={-1}>
        <Routes>
          <Route path={ROUTES.home} element={<LandingPage />} />
          <Route path={ROUTES.comps} element={<CompPage />} />
          <Route path={ROUTES.stats} element={<StatsPage />} />
          <Route path={ROUTES.builder} element={<CompBuilderPage />} />
          <Route path={ROUTES.leaderboard} element={<LeaderboardPage />} />
          <Route path={ROUTES.termsOfService} element={<TermsOfService />} />
          <Route path={ROUTES.privacyPolicy} element={<PrivacyPolicy />} />
          <Route
            path={ROUTES.summoner}
            element={<MatchHistoryPage />}
          />
          <Route
            path={ROUTES.summonerCompare}
            element={<MatchHistoryPage />}
          />
        </Routes>
      </main>

      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          {t("footer.disclaimer")}
        </p>
        <div className={styles.footerLinkContainer}>
          <Link to={ROUTES.termsOfService} className={styles.footerLink}>
            {t("footer.termsOfService")}
          </Link>
          <span className={styles.footerDivider}>|</span>
          <Link to={ROUTES.privacyPolicy} className={styles.footerLink}>
            {t("footer.privacyPolicy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
