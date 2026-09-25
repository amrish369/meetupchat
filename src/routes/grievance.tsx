import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, GRIEVANCE } from "@/components/legal-page";

export const Route = createFileRoute("/grievance")({
  head: () => ({
    meta: [
      { title: "Grievance Redressal — Meetup" },
      { name: "description", content: "Contact Meetup's Grievance Officer as required by India's IT Rules 2021 and DPDP Act 2023." },
      { property: "og:title", content: "Grievance Redressal — Meetup" },
      { property: "og:description", content: "Report content or raise a complaint. Acknowledged in 24 hours, resolved within 15 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GrievancePage,
});

function GrievancePage() {
  return (
    <LegalPage title="Grievance Redressal" updated="25 September 2026">
      <p>In line with Rule 3(2) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the DPDP Act, 2023, Meetup has appointed a Grievance Officer.</p>

      <div className="rounded-xl border border-border bg-card p-5">
        <p><strong>Grievance Officer:</strong> {GRIEVANCE.name}</p>
        <p><strong>Email:</strong> <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a></p>
        <p><strong>Address:</strong> {GRIEVANCE.address}</p>
        <p><strong>Hours:</strong> Monday–Friday, 10:00–18:00 IST</p>
      </div>

      <h2>How to file a complaint</h2>
      <ul>
        <li>Email the Grievance Officer with your account email, the user or content involved, and a short description.</li>
        <li>Or use the Report button inside any chat or call, or the <Link to="/support">Support</Link> page.</li>
      </ul>

      <h2>Timelines</h2>
      <ul>
        <li>Acknowledgement within 24 hours.</li>
        <li>Resolution within 15 days.</li>
        <li>Content exposing a person's private parts, nudity, sexual acts or impersonation (morphed images) is removed within 24 hours of a complaint.</li>
      </ul>

      <h2>Not satisfied?</h2>
      <p>You may appeal to the Grievance Appellate Committee (gac.gov.in) within 30 days, or for data issues, to the Data Protection Board of India. For cyber crimes, report at <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a> or call 1930.</p>
    </LegalPage>
  );
}
