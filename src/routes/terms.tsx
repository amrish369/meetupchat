import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, GRIEVANCE } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Meetup" },
      { name: "description", content: "Rules for using Meetup video and text chat, in line with India's IT Rules 2021." },
      { property: "og:title", content: "Terms of Service — Meetup" },
      { property: "og:description", content: "The rules every Meetup user agrees to: 18+, respectful conduct, no illegal content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="25 September 2026">
      <p>These Terms govern your use of Meetup ("we", "us"), an intermediary platform under the Information Technology Act, 2000 and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. By using Meetup you agree to these Terms, our <Link to="/privacy">Privacy Policy</Link> and <Link to="/safety">Community Rules</Link>.</p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 18 years old. Accounts found to belong to minors are removed immediately.</p>

      <h2>2. Prohibited content and conduct (Rule 3(1)(b))</h2>
      <p>You must not host, display, upload, share or transmit anything that:</p>
      <ul>
        <li>belongs to another person without right to it;</li>
        <li>is obscene, pornographic, paedophilic, or invasive of another's privacy, including bodily privacy;</li>
        <li>insults or harasses on the basis of gender, religion, caste, race or ethnicity;</li>
        <li>is harmful to children;</li>
        <li>infringes any patent, trademark, copyright or other proprietary right;</li>
        <li>deceives or misleads, or knowingly spreads false or misleading information;</li>
        <li>impersonates another person;</li>
        <li>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign States, or public order, or incites any offence;</li>
        <li>contains malware or any code designed to interrupt or damage any computer resource;</li>
        <li>violates any law currently in force.</li>
      </ul>
      <p>Screen recording or capturing other users without consent is prohibited.</p>

      <h2>3. Moderation and enforcement</h2>
      <p>We use automated checks and human review. We may warn, suspend or permanently ban accounts that break these Terms. On receiving actual knowledge through a court order or government notice, we remove or disable access to unlawful content within 36 hours. Content showing nudity or sexual acts of a person, reported by that person, is removed within 24 hours.</p>

      <h2>4. Payments and premium</h2>
      <p>Premium plans and coins are digital services. Payments are verified manually. Refunds are handled on a case-by-case basis through <Link to="/support">Support</Link>.</p>

      <h2>5. Cooperation with authorities</h2>
      <p>We keep relevant information for 180 days after account deletion or content removal, and share it with authorised government agencies when required by law, within 72 hours of a lawful request.</p>

      <h2>6. Disclaimer</h2>
      <p>Users are responsible for their own conversations. Meetup is provided "as is" without warranties to the extent allowed by law.</p>

      <h2>7. Grievance Officer</h2>
      <p>For complaints, contact our Grievance Officer — see the <Link to="/grievance">Grievance Redressal</Link> page ({GRIEVANCE.email}).</p>

      <h2>8. Governing law</h2>
      <p>These Terms are governed by the laws of India. Courts in India have exclusive jurisdiction.</p>
    </LegalPage>
  );
}
