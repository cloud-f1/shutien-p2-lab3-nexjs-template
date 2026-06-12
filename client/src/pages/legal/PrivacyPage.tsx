import Seo from "../../components/Seo";
import LegalLayout from "./LegalLayout";

const sections = [
  { id: "p1", num: "01", title: "What We Collect" },
  { id: "p2", num: "02", title: "What We Do NOT Collect" },
  { id: "p3", num: "03", title: "How We Use Your Data" },
  { id: "p4", num: "04", title: "Data Storage & Security" },
  { id: "p5", num: "05", title: "Third-Party Services" },
  { id: "p6", num: "06", title: "Cookies" },
  { id: "p7", num: "07", title: "Your Rights" },
  { id: "p8", num: "08", title: "Children's Privacy" },
  { id: "p9", num: "09", title: "Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalLayout>
      <Seo
        title="Privacy Policy"
        description="Privacy policy for Claude Agent Template. We collect minimal data, never sell it, and your project files stay on your machine."
        path="/privacy"
      />

      <header className="legal-header">
        <div className="legal-eyebrow">Legal</div>
        <h1 className="legal-title">Privacy Policy</h1>
        <div className="legal-meta">
          <span>Effective: March 1, 2026</span>
          <span>&middot;</span>
          <span>Last updated: March 7, 2026</span>
          <span>&middot;</span>
          <span>Version 1.0</span>
        </div>
      </header>

      <div className="legal-highlight legal-highlight--green">
        <p>
          <strong>Short version:</strong> We collect minimal data, never sell
          it, and your project files stay on your machine. The dashboard only
          stores account preferences and usage metadata.
        </p>
      </div>

      <nav className="legal-toc" aria-label="Table of contents">
        <div className="legal-toc-title">Contents</div>
        <ol className="legal-toc-list">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>
                <span className="legal-toc-num">{s.num}</span> {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 01 — What We Collect */}
      <section className="legal-section" id="p1">
        <h2>
          <span className="legal-sec-num">01</span> What We Collect
        </h2>
        <p>We collect the minimum necessary to provide account features:</p>
        <div className="legal-data-box">
          <div className="legal-data-header">Data we collect</div>
          <div className="legal-data-row">
            <span className="legal-data-key">Account info</span>
            <span className="legal-data-val">
              Name, email address, GitHub handle (optional). Used for
              authentication and dashboard attribution.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">Authentication</span>
            <span className="legal-data-val">
              Hashed passwords (bcrypt). OAuth tokens if using Google/GitHub
              sign-in. Never stored in plaintext.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">Usage metadata</span>
            <span className="legal-data-val">
              Number of projects, template version, last active date. No content
              of your projects.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">Preferences</span>
            <span className="legal-data-val">
              Dashboard settings, coverage gate threshold, notification
              preferences.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">Log data</span>
            <span className="legal-data-val">
              Standard server logs: IP address, timestamp, request path.
              Retained for 30 days, then deleted.
            </span>
          </div>
        </div>
      </section>

      {/* 02 — What We Do NOT Collect */}
      <section className="legal-section" id="p2">
        <h2>
          <span className="legal-sec-num">02</span> What We Do NOT Collect
        </h2>
        <div className="legal-highlight legal-highlight--blue">
          <p>
            Your code, project files, agent logs, memory files, and template
            content all stay on your local machine. We never see them, never
            store them, never transmit them.
          </p>
        </div>
        <p>We also do not collect:</p>
        <ul>
          <li>
            Content of your <code className="legal-code">docs/context/</code>{" "}
            files or template memory
          </li>
          <li>Claude Code session transcripts or agent conversations</li>
          <li>Your Anthropic API keys or credentials</li>
          <li>
            Financial or payment information (we don&rsquo;t currently charge)
          </li>
          <li>Biometric data of any kind</li>
        </ul>
      </section>

      {/* 03 — How We Use Your Data */}
      <section className="legal-section" id="p3">
        <h2>
          <span className="legal-sec-num">03</span> How We Use Your Data
        </h2>
        <p>Data we collect is used exclusively to:</p>
        <ul>
          <li>Authenticate you and maintain your session</li>
          <li>Display your dashboard and persist your settings</li>
          <li>
            Send transactional emails (account verification, password reset)
          </li>
          <li>Diagnose technical issues and improve service reliability</li>
        </ul>
        <p>
          We <strong>never</strong> sell, rent, or trade your personal data. We
          do not use your data for advertising. We do not share it with third
          parties except as described in Section 05.
        </p>
      </section>

      {/* 04 — Data Storage & Security */}
      <section className="legal-section" id="p4">
        <h2>
          <span className="legal-sec-num">04</span> Data Storage &amp; Security
        </h2>
        <p>
          Account data is stored in a PostgreSQL database hosted on Zeabur
          infrastructure. We use:
        </p>
        <ul>
          <li>bcrypt for password hashing (never stored plaintext)</li>
          <li>JWT tokens with short expiry for session management</li>
          <li>HTTPS for all data in transit</li>
          <li>Environment variables for all secrets (never in code)</li>
        </ul>
        <p>
          We follow the security patterns documented in our open-source template
          &mdash; the same ones enforced by <strong>@code-reviewer</strong> on
          every deploy.
        </p>
        <p>
          In the event of a data breach, we will notify affected users within 72
          hours.
        </p>
      </section>

      {/* 05 — Third-Party Services */}
      <section className="legal-section" id="p5">
        <h2>
          <span className="legal-sec-num">05</span> Third-Party Services
        </h2>
        <div className="legal-data-box">
          <div className="legal-data-header">Services we use</div>
          <div className="legal-data-row">
            <span className="legal-data-key">Zeabur</span>
            <span className="legal-data-val">
              Hosting infrastructure. Subject to Zeabur&rsquo;s privacy policy.
              Processes IP addresses and request metadata.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">Google OAuth</span>
            <span className="legal-data-val">
              Optional sign-in only. We receive: name, email, profile picture.
              We do not access your Google data.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">GitHub OAuth</span>
            <span className="legal-data-val">
              Optional sign-in only. We receive: username and public email. We
              do not access your repositories.
            </span>
          </div>
          <div className="legal-data-row">
            <span className="legal-data-key">Anthropic</span>
            <span className="legal-data-val">
              Claude Code is a separate product. Your AI interactions are
              governed by Anthropic&rsquo;s privacy policy, not ours.
            </span>
          </div>
        </div>
      </section>

      {/* 06 — Cookies */}
      <section className="legal-section" id="p6">
        <h2>
          <span className="legal-sec-num">06</span> Cookies
        </h2>
        <p>We use cookies only for:</p>
        <ul>
          <li>
            <strong>Authentication</strong> &mdash; httpOnly session cookie to
            keep you logged in
          </li>
          <li>
            <strong>Preferences</strong> &mdash; remembering dashboard state
            (dark mode, active view)
          </li>
        </ul>
        <p>
          We do not use advertising cookies, tracking pixels, or third-party
          analytics cookies. No cookie consent banner is required because we
          don&rsquo;t use non-essential cookies.
        </p>
      </section>

      {/* 07 — Your Rights */}
      <section className="legal-section" id="p7">
        <h2>
          <span className="legal-sec-num">07</span> Your Rights
        </h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> &mdash; request a copy of all data we hold
            about you
          </li>
          <li>
            <strong>Correction</strong> &mdash; update your name, email, or
            preferences at any time in Settings
          </li>
          <li>
            <strong>Deletion</strong> &mdash; delete your account instantly
            via{" "}
            <a href="/dashboard">Dashboard Settings</a> &rarr; Danger Zone.
            Your account and all associated data are permanently removed
            immediately (GDPR Art. 17 — right to erasure).
          </li>
          <li>
            <strong>Portability</strong> &mdash; request your data in JSON
            format
          </li>
          <li>
            <strong>Objection</strong> &mdash; opt out of any non-essential
            processing
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at the address in Section
          09. We will respond within 30 days.
        </p>
      </section>

      {/* 08 — Children's Privacy */}
      <section className="legal-section" id="p8">
        <h2>
          <span className="legal-sec-num">08</span> Children&rsquo;s Privacy
        </h2>
        <p>
          The Service is not directed to children under 13. We do not knowingly
          collect personal information from children under 13. If you believe a
          child has provided us with personal information, please contact us and
          we will delete it promptly.
        </p>
      </section>

      {/* 09 — Contact */}
      <section className="legal-section" id="p9">
        <h2>
          <span className="legal-sec-num">09</span> Contact
        </h2>
        <p>For privacy questions, data requests, or concerns:</p>
        <div className="legal-contact">
          <p style={{ marginBottom: 6 }}>
            <strong>Claude Agent Template</strong>
          </p>
          <p style={{ marginBottom: 4 }}>
            GitHub Issues:{" "}
            <a
              href="https://github.com/alexhsieh/claude-agent-template/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/alexhsieh/claude-agent-template/issues
            </a>
          </p>
          <p style={{ marginBottom: 4 }}>
            Community:{" "}
            <a
              href="https://www.skool.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Skool Community
            </a>
          </p>
          <p style={{ margin: 0 }}>
            Response time: within 30 days for data requests, within 5 days for
            general privacy questions
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}
