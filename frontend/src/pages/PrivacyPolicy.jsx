import React from "react";
import { Link } from "react-router-dom";
import "../styles/legal.css";

function PrivacyPolicy() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link className="legal-brand" to="/">
            DentoGraph
          </Link>

          <div className="legal-header-actions">
            <Link to="/terms-of-service">Terms of Service</Link>
            <Link className="legal-back-button" to="/auth/login">
              Back to Login
            </Link>
          </div>
        </header>

        <article className="legal-document">
          <div className="legal-title-block">
            <span className="legal-eyebrow">DentoGraph Legal</span>
            <h1>Privacy Policy</h1>
            <p>Effective date: July 16, 2026</p>
          </div>

          <div className="legal-notice">
            DentoGraph processes personal data and sensitive personal
            information to provide dental-record and clinic-management services.
            This Policy explains what is collected, why it is processed, how it
            is protected, and the choices available to users.
          </div>

          <section>
            <h2>1. Scope of this Policy</h2>
            <p>
              This Policy applies to DentoGraph’s public registration pages, web
              and mobile applications, clinic-management tools, dental-record
              functions, X-ray and document features, subscriptions, reports,
              maps, AI-assisted tools, and related support services.
            </p>
          </section>

          <section>
            <h2>2. Who handles your information</h2>
            <p>
              DentoGraph provides the platform used by subscribed dental
              clinics. The clinic responsible for a patient or staff account
              generally determines why and how clinic records are used.
              DentoGraph processes information to operate and secure the
              platform, provide contracted services, maintain tenant and
              clinic-location isolation, and comply with lawful obligations.
            </p>
            <p>
              Questions about a specific dental record, appointment, treatment,
              correction, or disclosure should normally be directed first to the
              clinic that created or manages that record.
            </p>
          </section>

          <section>
            <h2>3. Information we may collect</h2>

            <h3>Account and identity information</h3>
            <ul>
              <li>
                Name, email address, password hash, role, account status, and
                verification information.
              </li>
              <li>
                Contact details, address, profile details, and clinic
                assignment.
              </li>
              <li>
                Government identification and professional credential documents
                submitted for staff verification.
              </li>
            </ul>

            <h3>Clinic and subscription information</h3>
            <ul>
              <li>
                Clinic name, address, coordinates, contact details, hours,
                services, branding, and location status.
              </li>
              <li>
                Subscription plan, billing cycle, payment reference, limits, and
                subscription status.
              </li>
            </ul>

            <h3>Patient and dental information</h3>
            <ul>
              <li>Patient profile and appointment information.</li>
              <li>
                Dental charts, per-tooth conditions, DMFT-related information,
                diagnoses, treatment history, and clinical notes.
              </li>
              <li>
                X-rays, annotations, uploaded records, images, AR previews, and
                related documents.
              </li>
              <li>
                Information entered by authorized dental professionals about
                care and clinic activity.
              </li>
            </ul>

            <h3>Technical and security information</h3>
            <ul>
              <li>
                IP address, login and audit events, browser or device
                information, timestamps, and security logs.
              </li>
              <li>
                Session, authentication, error, upload, and system-performance
                information.
              </li>
              <li>
                Approximate or precise location when a user enables clinic
                discovery, map selection, or address geocoding.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Sensitive personal information</h2>
            <p>
              Dental records, health information, X-rays, clinical findings, and
              some identification and credential documents may be considered
              sensitive personal information. DentoGraph applies additional
              access controls and limits processing to authorized purposes.
            </p>
          </section>

          <section>
            <h2>5. Why information is processed</h2>
            <p>Information may be processed to:</p>
            <ul>
              <li>
                Create and administer user, staff, patient, and clinic accounts.
              </li>
              <li>Schedule and manage appointments.</li>
              <li>
                Create, maintain, display, and securely share authorized dental
                records.
              </li>
              <li>
                Upload, store, annotate, and review X-rays and supporting
                documents.
              </li>
              <li>Verify Dentist and Dental Assistant credentials.</li>
              <li>
                Provide clinic discovery, mapping, geocoding, and navigation
                support.
              </li>
              <li>
                Provide reports, analytics, 3D visualization, AI-assisted
                review, and AR preview features.
              </li>
              <li>
                Manage subscriptions, payments, storage, staff limits, and
                clinic-location limits.
              </li>
              <li>
                Authenticate users, prevent abuse, investigate incidents, and
                maintain audit logs.
              </li>
              <li>
                Comply with legal obligations and respond to lawful requests.
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Basis for processing</h2>
            <p>
              Depending on the information and context, processing may be based
              on consent, performance of a service agreement, compliance with a
              legal obligation, protection of lawful interests and system
              security, medical treatment or healthcare administration by
              authorized professionals, or another basis permitted by Philippine
              law.
            </p>
          </section>

          <section>
            <h2>7. How information is shared</h2>
            <p>Information may be shared only as reasonably necessary with:</p>
            <ul>
              <li>
                The clinic, Clinic Owner, Dentist, Dental Assistant, Patient, or
                Administrator authorized for the relevant record or location.
              </li>
              <li>
                Hosting, database, email, payment, mapping, storage, analytics,
                security, or AI service providers acting under appropriate
                arrangements.
              </li>
              <li>
                Professional advisers, auditors, insurers, or support personnel
                where necessary and authorized.
              </li>
              <li>
                Government authorities, regulators, courts, or law-enforcement
                agencies when required by law or valid legal process.
              </li>
              <li>
                A successor operator in a lawful merger, restructuring, or
                transfer, subject to applicable privacy safeguards.
              </li>
            </ul>
            <p>
              DentoGraph does not sell patient dental records or staff
              credential documents to advertisers.
            </p>
          </section>

          <section>
            <h2>8. Clinic and location isolation</h2>
            <p>
              Operational records are associated with clinic locations and user
              roles. Clinic Owners are limited to locations they own, while
              staff and patients are limited to their assigned location and
              permitted records. Administrators may access system-wide
              information when required for administration, security, support,
              compliance, or authorized review.
            </p>
          </section>

          <section>
            <h2>9. AI, X-ray, AR, and visualization processing</h2>
            <p>
              When these features are used, images or record information may be
              processed to generate annotations, assistance, visualizations, or
              previews. Results are not guaranteed to be accurate and are not a
              substitute for a licensed professional’s judgment.
            </p>
            <p>
              Clinics should avoid submitting information to an optional
              third-party feature unless its use is authorized and appropriate
              for the patient and the intended clinical purpose.
            </p>
          </section>

          <section>
            <h2>10. Maps and geocoding</h2>
            <p>
              Clinic registration and location management may send a typed
              clinic address to a mapping or geocoding provider to return
              possible coordinates. Patient clinic discovery may process device
              location only when location access is enabled. Mapping providers
              may process technical information under their own privacy terms.
            </p>
          </section>

          <section>
            <h2>11. Cookies, sessions, and local storage</h2>
            <p>
              DentoGraph may use browser storage, authentication tokens, and
              strictly necessary session technologies to keep users signed in,
              remember selected clinic context, preserve security settings, and
              operate the interface. Blocking required storage may prevent parts
              of the platform from functioning.
            </p>
          </section>

          <section>
            <h2>12. Retention</h2>
            <p>
              Information is retained only for as long as reasonably necessary
              for treatment records, clinic operations, contractual services,
              security, audit, dispute handling, and legal or regulatory
              obligations. Retention periods may vary by record type and clinic
              responsibility.
            </p>
            <p>
              Pending staff applications rejected by an Administrator may be
              deleted together with their account, staff profile, credential
              record, and uploaded verification documents. Backups and security
              logs may remain for a limited period before scheduled deletion.
            </p>
          </section>

          <section>
            <h2>13. Security measures</h2>
            <p>
              DentoGraph uses measures such as authenticated access, password
              hashing, role-based authorization, clinic-location isolation,
              protected routes, validation, upload restrictions, audit logging,
              security headers, and database integrity controls. No electronic
              system can guarantee absolute security, so users and clinics must
              also protect devices, passwords, accounts, and exported records.
            </p>
          </section>

          <section>
            <h2>14. Data-subject rights</h2>
            <p>
              Subject to applicable law and verification of identity, a person
              may have rights to be informed, access personal data, object to or
              restrict certain processing, correct inaccurate information,
              request erasure or blocking when legally permitted, obtain data in
              an appropriate portable form, withdraw consent where consent is
              the basis, and seek damages or file a complaint.
            </p>
            <p>
              Requests concerning dental or clinic records should be submitted
              to the clinic managing the record. Requests concerning
              platform-level account or security processing may be submitted
              through the official support channel available in DentoGraph.
            </p>
          </section>

          <section>
            <h2>15. Children and minors</h2>
            <p>
              Pediatric dental records may be created and managed by authorized
              clinics. Where required, a parent, legal guardian, or other
              authorized representative should provide the appropriate
              permission and exercise privacy rights on behalf of a minor.
            </p>
          </section>

          <section>
            <h2>16. International and third-party processing</h2>
            <p>
              Some technology providers may process or store information outside
              the Philippines. When this occurs, reasonable contractual,
              organizational, and technical safeguards should be used as
              required by applicable law.
            </p>
          </section>

          <section>
            <h2>17. Personal data breaches</h2>
            <p>
              Suspected privacy or security incidents should be reported
              promptly through the clinic or official support channel.
              DentoGraph and the responsible clinic will assess incidents and
              provide notifications to affected persons or authorities when
              required by applicable law.
            </p>
          </section>

          <section>
            <h2>18. Complaints</h2>
            <p>
              Users may first contact the responsible clinic or DentoGraph
              support channel to resolve a privacy concern. A person may also
              exercise any right to submit a complaint to the Philippine
              National Privacy Commission when applicable.
            </p>
          </section>

          <section>
            <h2>19. Changes to this Policy</h2>
            <p>
              This Policy may be updated when features, providers, security
              measures, or legal requirements change. The current effective date
              will be shown at the top of this page.
            </p>
          </section>

          <section>
            <h2>20. Contact</h2>
            <p>
              For record-specific questions, contact the dental clinic managing
              the account or record. For platform-level privacy or security
              concerns, use the official support or contact channel displayed
              within DentoGraph.
            </p>
          </section>

          <div className="legal-footer-links">
            <Link to="/terms-of-service">Read the Terms of Service</Link>
            <Link to="/auth/register">Patient Registration</Link>
            <Link to="/clinic/register">Clinic Registration</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

export default PrivacyPolicy;
