import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, GRIEVANCE } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Meetup" },
      { name: "description", content: "How Meetup collects, uses and protects your personal data under India's DPDP Act, 2023." },
      { property: "og:title", content: "Privacy Policy — Meetup" },
      { property: "og:description", content: "Your data rights on Meetup: access, correction, deletion and grievance redressal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="25 September 2026">
      <p>This policy explains how Meetup processes your personal data as a Data Fiduciary under the Digital Personal Data Protection Act, 2023 (DPDP Act) and the IT Act, 2000.</p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>Account: email or phone number, Google profile name and picture (if you sign in with Google).</li>
        <li>Profile: display name, avatar, gender, region, date of birth (to confirm you are 18+).</li>
        <li>Activity: matches, messages, follows, gifts, coins, reports and moderation events.</li>
        <li>Payments: UPI transaction reference and payment screenshot you upload.</li>
        <li>Technical: device and browser info needed to run calls.</li>
      </ul>
      <p>Video and audio in calls travel peer-to-peer and are <strong>not recorded or stored</strong> by us. Nudity detection runs on your own device.</p>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To run matching, chat and calls;</li>
        <li>To keep the platform safe (age checks, moderation, abuse reports);</li>
        <li>To process premium payments;</li>
        <li>To meet legal duties under Indian law.</li>
      </ul>
      <p>We rely on your consent, given when you sign up. You can withdraw consent at any time by deleting your account.</p>

      <h2>3. Sharing</h2>
      <p>We do not sell your data. We share it only with service providers that host our app, and with government agencies when legally required. Ads on content pages are served by Google AdSense, which may use cookies — see Google's policies.</p>

      <h2>4. Retention</h2>
      <p>We keep data while your account is active. After deletion we keep limited records for 180 days as required by the IT Rules, 2021, then erase them.</p>

      <h2>5. Your rights</h2>
      <ul>
        <li>Access a summary of your data;</li>
        <li>Correct or update it (from your <Link to="/profile">Profile</Link>);</li>
        <li>Erase your data and account;</li>
        <li>Nominate another person to exercise rights on your behalf;</li>
        <li>Raise a grievance, and then approach the Data Protection Board of India.</li>
      </ul>
      <p>Email {GRIEVANCE.email} to use any of these rights. We reply within 30 days.</p>

      <h2>6. Children</h2>
      <p>Meetup is only for adults (18+). We do not knowingly process children's data; such accounts are deleted.</p>

      <h2>7. Security</h2>
      <p>We use encryption in transit, access controls and row-level security on our database. If a breach happens, we will inform affected users and the Data Protection Board as required.</p>

      <h2>8. Contact</h2>
      <p>See <Link to="/grievance">Grievance Redressal</Link>.</p>
    </LegalPage>
  );
}
