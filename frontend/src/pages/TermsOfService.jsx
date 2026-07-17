import React from "react";
import { Link } from "react-router-dom";
import "../styles/legal.css";

function TermsOfService() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link className="legal-brand" to="/">
            DentoGraph
          </Link>

          <div className="legal-header-actions">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link className="legal-back-button" to="/auth/login">
              Back to Login
            </Link>
          </div>
        </header>

        <article className="legal-document">
          <div className="legal-title-block">
            <span className="legal-eyebrow">DentoGraph Legal</span>
            <h1>Terms of Service</h1>
            <p>Effective date: July 16, 2026</p>
          </div>

          <div className="legal-notice">
            Please read these Terms before creating an account or using
            DentoGraph. By registering, accessing, or using the system, you
            agree to these Terms and the Privacy Policy.
          </div>

          <section>
            <h2>1. About DentoGraph</h2>
            <p>
              DentoGraph is a subscription-based web and mobile dental record
              management platform designed for dental clinics, clinic owners,
              dentists, dental assistants, patients, and system administrators.
              Depending on the features enabled for a clinic, the platform may
              support appointments, dental records, per-tooth charting, X-rays,
              annotations, reports, clinic discovery, subscriptions, 3D dental
              visualization, artificial-intelligence-assisted X-ray review, and
              augmented-reality braces previews.
            </p>
          </section>

          <section>
            <h2>2. Account eligibility and registration</h2>
            <p>
              You must provide accurate, current, and complete information when
              registering. You must not impersonate another person, submit false
              professional credentials, or create an account for an unauthorized
              purpose.
            </p>
            <p>
              Clinic Owner accounts may create staff accounts for their owned
              clinic locations. Newly submitted Dentist and Dental Assistant
              accounts may remain inactive until their professional credentials
              are reviewed and approved by an authorized Administrator.
            </p>
          </section>

          <section>
            <h2>3. Roles and access permissions</h2>
            <p>
              Access is role-based. Administrators have system-wide management
              functions. Clinic Owners are limited to clinics they own.
              Dentists, Dental Assistants, and Patients are limited to the
              clinic location and records assigned to them, subject to the
              permissions configured in the system.
            </p>
            <p>
              You must not attempt to access records, locations, features, or
              accounts outside your authorized role or clinic assignment.
            </p>
          </section>

          <section>
            <h2>4. Clinic responsibilities</h2>
            <p>
              Each subscribed clinic is responsible for the lawful collection,
              accuracy, use, disclosure, retention, and professional handling of
              patient information entered into DentoGraph. Clinics are also
              responsible for confirming staff identities, maintaining valid
              licenses and qualifications, obtaining patient permissions when
              required, and following applicable healthcare and privacy rules.
            </p>
          </section>

          <section>
            <h2>5. Patient records and clinical decisions</h2>
            <p>
              DentoGraph stores and displays information entered by authorized
              clinics and dental professionals. The platform does not replace
              professional dental judgment, diagnosis, treatment planning,
              informed consent, or emergency care.
            </p>
            <p>
              Patients should contact their assigned clinic or a qualified
              dental professional for questions about their records, symptoms,
              diagnosis, or treatment. In an emergency, contact an appropriate
              emergency service or healthcare provider.
            </p>
          </section>

          <section>
            <h2>6. AI-assisted and visualization features</h2>
            <p>
              AI-assisted X-ray results, 3D visualizations, dental charts, and
              AR braces previews are support and visualization tools only. They
              may be incomplete, inaccurate, unavailable, or affected by image
              quality, device capability, model limitations, or user input.
            </p>
            <p>
              These features must not be treated as a final diagnosis,
              guaranteed treatment result, or substitute for review by a
              licensed dental professional.
            </p>
          </section>

          <section>
            <h2>7. Subscription and clinic-location limits</h2>
            <p>
              Clinic features, storage, staff limits, and the number of clinic
              locations may depend on the selected subscription plan. A shared
              Clinic Owner subscription may apply across all owned locations.
              The system may restrict creation of additional locations or staff
              when a plan is inactive, expired, or has reached its limit.
            </p>
            <p>
              Subscription fees, billing cycles, renewals, upgrades, and payment
              processing are subject to the plan details presented during
              checkout. Except when required by law or expressly stated in the
              applicable plan, paid fees are non-refundable after the subscribed
              service has been made available.
            </p>
          </section>

          <section>
            <h2>8. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Access or disclose records without authorization.</li>
              <li>
                Upload malicious code, unlawful content, or falsified records.
              </li>
              <li>
                Bypass authentication, clinic isolation, or role permissions.
              </li>
              <li>
                Probe, disrupt, overload, copy, reverse engineer, or misuse the
                platform.
              </li>
              <li>
                Use another person’s credentials or share your password or
                access token.
              </li>
              <li>
                Use DentoGraph for harassment, fraud, discrimination, or
                unlawful surveillance.
              </li>
            </ul>
          </section>

          <section>
            <h2>9. Account security</h2>
            <p>
              You are responsible for keeping your password and devices secure.
              Notify the clinic or system administrator promptly when you
              suspect unauthorized access. DentoGraph may require password
              changes, invalidate sessions, restrict access, or suspend an
              account to protect users and records.
            </p>
          </section>

          <section>
            <h2>10. Uploaded content and records</h2>
            <p>
              Clinics and authorized users retain responsibility for the
              information and documents they upload. By using the platform, they
              authorize DentoGraph to host, process, transmit, back up, and
              display that information only as needed to operate, secure,
              support, and improve the contracted service.
            </p>
            <p>
              Users must ensure they have authority to upload X-rays, dental
              records, identification documents, credential documents, images,
              annotations, and other content.
            </p>
          </section>

          <section>
            <h2>11. Availability and changes</h2>
            <p>
              DentoGraph may undergo maintenance, upgrades, security changes, or
              temporary interruptions. Features may be modified when necessary
              for security, compliance, reliability, or system improvement.
              Reasonable efforts will be made to preserve service continuity,
              but uninterrupted or error-free availability is not guaranteed.
            </p>
          </section>

          <section>
            <h2>12. Suspension and termination</h2>
            <p>
              Accounts may be suspended, restricted, or terminated for false
              credentials, unauthorized access, nonpayment, expired
              subscription, security risk, unlawful activity, material breach of
              these Terms, or a valid instruction from an authorized clinic or
              government authority.
            </p>
            <p>
              Rejected pending staff applications may be deleted together with
              the related account, profile, credential record, and uploaded
              verification documents.
            </p>
          </section>

          <section>
            <h2>13. Intellectual property</h2>
            <p>
              The DentoGraph name, interface, source code, design, workflows,
              documentation, and platform materials are protected by applicable
              intellectual-property laws. These Terms grant only a limited,
              revocable, non-transferable right to use the service according to
              the assigned role and active subscription.
            </p>
          </section>

          <section>
            <h2>14. Disclaimers and limitation</h2>
            <p>
              To the extent permitted by law, DentoGraph is provided on an “as
              available” basis. The platform is not responsible for clinical
              decisions, inaccurate information supplied by users, unauthorized
              access caused by shared credentials or insecure devices,
              third-party service interruptions, or outcomes based solely on AI
              or visualization features.
            </p>
            <p>
              Nothing in these Terms excludes rights or liabilities that cannot
              lawfully be excluded under Philippine law.
            </p>
          </section>

          <section>
            <h2>15. Privacy</h2>
            <p>
              Personal data and sensitive personal information are handled as
              described in the DentoGraph Privacy Policy and in accordance with
              applicable Philippine data-protection requirements, including the
              Data Privacy Act of 2012 and its implementing rules.
            </p>
          </section>

          <section>
            <h2>16. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws of the Republic of the
              Philippines. Users should first raise concerns through the clinic
              responsible for the account or record, or through the support
              channel made available in DentoGraph. This does not prevent a
              person from exercising rights or remedies available under
              applicable law.
            </p>
          </section>

          <section>
            <h2>17. Changes to these Terms</h2>
            <p>
              These Terms may be updated to reflect changes in features,
              security, operations, or legal requirements. The updated effective
              date will be displayed on this page. Continued use after an update
              constitutes acceptance when permitted by law.
            </p>
          </section>

          <section>
            <h2>18. Contact and support</h2>
            <p>
              Questions about an account, clinic subscription, dental record, or
              these Terms should be submitted through the responsible clinic or
              the official support channel displayed within DentoGraph.
            </p>
          </section>

          <div className="legal-footer-links">
            <Link to="/privacy-policy">Read the Privacy Policy</Link>
            <Link to="/auth/register">Patient Registration</Link>
            <Link to="/clinic/register">Clinic Registration</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

export default TermsOfService;
