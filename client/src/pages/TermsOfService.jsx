import { useTranslation } from 'react-i18next'
import { PageShell } from '../components/layout/PageShell.jsx'
import styles from "./TermsOfService.module.css";

export default function TermsOfService() {
  const { t, i18n } = useTranslation()
  return (
    <PageShell>
      <h1 className={styles.title}>{t('tos.title')}</h1>
      {i18n.language !== 'en' && <p className={styles.languageNotice}>{t('tos.languageNotice')}</p>}
      <p className={styles.lastUpdated}>Last Updated: April 29, 2026</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Acceptance of Terms</h2>
        <p className={styles.body}>
          By accessing or using TFT DUalytics, you agree to be bound by these
          Terms of Service and all applicable laws and regulations. If you do
          not agree with any of these terms, you are prohibited from using or
          accessing this site.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Riot Games Disclaimer</h2>
        <p className={styles.body}>
          TFT DUalytics isn't endorsed by Riot Games and doesn't reflect the
          views or opinions of Riot Games or anyone officially involved in
          producing or managing League of Legends or Teamfight Tactics. Riot
          Games, and League of Legends are trademarks or registered trademarks
          of Riot Games, Inc.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Use License</h2>
        <p className={styles.body}>
          Permission is granted to temporarily view the materials (information
          or software) on the website for personal, non-commercial transitory
          viewing only. Under this license, you may not:
        </p>
        <ul className={styles.list}>
          <li>Modify or copy the materials for commercial purposes.</li>
          <li>
            Attempt to decompile or reverse engineer any software contained on
            the platform.
          </li>
          <li>
            Remove any copyright or other proprietary notations from the
            materials.
          </li>
          <li>
            Use any automated "scraping" tools to extract data from our teammate
            frequency or match history tables.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>User Accounts & Data</h2>
        <p className={styles.body}>
          Our platform utilizes public Riot Games API data to provide
          statistics.
        </p>
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>Accuracy</h3>
          <p className={styles.body}>
            While we strive for precision in our "Double Up" win rates and
            placement tracking, we are not responsible for inaccuracies derived
            from upstream data providers.
          </p>
        </div>
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>Privacy</h3>
          <p className={styles.body}>
            We respect your privacy. Any data collected, including Riot IDs used
            for lookups, is handled in accordance with our Privacy Policy.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Intellectual Property</h2>
        <p className={styles.body}>
          The design, including the "premium minimalist" aesthetic, custom
          "Quoted" integrations, and the hexagonal board UI logic, are the
          intellectual property of TFT DUalytics. All custom mascots and
          branding are reserved.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Limitations of Liability</h2>
        <p className={styles.body}>
          In no event shall TFT DUalytics or its developers be liable for any
          damages (including, without limitation, damages for loss of data or
          profit) arising out of the use or inability to use the materials on
          the website.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Modifications</h2>
        <p className={styles.body}>
          We may revise these terms of service for its website at any time
          without notice. By using this website you are agreeing to be bound by
          the then-current version of these terms.
        </p>
      </section>
    </PageShell>
  );
}
