import { useTranslation } from 'react-i18next'
import { PageShell } from '../components/layout/PageShell.jsx'
import styles from './PrivacyPolicy.module.css';

const PrivacyPolicy = () => {
  const { t, i18n } = useTranslation()
  return (
    <PageShell>
      <h1 className={styles.title}>{t('privacy.title')}</h1>
      {i18n.language !== 'en' && <p className={styles.languageNotice}>{t('privacy.languageNotice')}</p>}
      <p className={styles.lastUpdated}>Last Updated: April 29, 2026</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Information We Collect</h2>
        <p className={styles.body}>
          To provide accurate statistics and performance tracking for Double Up, we collect data through the following methods:
        </p>
        <ul className={styles.list}>
          <li>Public game data via the Riot Games API (Summoner Name, PUUID, Match History).</li>
          <li>Performance metrics and teammate identification tags.</li>
          <li>Standard usage data and session cookies for site performance.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Use of Information</h2>
        <p className={styles.body}>
          Data collected is used strictly for the functionality of the platform:
        </p>
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>Statistical Analysis</h3>
          <p className={styles.body}>
            Calculating win rates, average placements, and teammate frequency scores.
          </p>
        </div>
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>Compliance</h3>
          <p className={styles.body}>
            Ensuring all displayed information adheres to Riot Games Developer Policies and Terms of Service.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Third-Party Services</h2>
        <p className={styles.body}>
          Our services integrate with third-party APIs. By using this site, you acknowledge that your data is processed according to the Riot Games Privacy Policy. We do not sell or distribute personal data to external marketing firms.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Contact</h2>
        <p className={styles.body}>
          For inquiries regarding data usage or privacy concerns, contact: support@tftdualytics.gg
        </p>
      </section>
    </PageShell>
  );
};

export default PrivacyPolicy;