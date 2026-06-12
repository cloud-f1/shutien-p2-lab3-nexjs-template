import Seo from "../../components/Seo";
import LegalLayout from "./LegalLayout";

const sections = [
  { id: "s1", num: "01", title: "Acceptance of Terms" },
  { id: "s2", num: "02", title: "Description of Service" },
  { id: "s3", num: "03", title: "License Grant" },
  { id: "s4", num: "04", title: "User Responsibilities" },
  { id: "s5", num: "05", title: "Intellectual Property" },
  { id: "s6", num: "06", title: "Disclaimers & Limitation of Liability" },
  { id: "s7", num: "07", title: "Termination" },
  { id: "s8", num: "08", title: "Governing Law" },
  { id: "s9", num: "09", title: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalLayout>
      <Seo
        title="Terms of Service"
        description="Terms of Service for Claude Agent Template. Open-source MIT-licensed template with web service terms for account and dashboard features."
        path="/terms"
      />

      <header className="legal-header">
        <div className="legal-eyebrow">Legal</div>
        <h1 className="legal-title">Terms of Service</h1>
        <div className="legal-meta">
          <span>Effective: March 1, 2026</span>
          <span>&middot;</span>
          <span>Last updated: March 7, 2026</span>
          <span>&middot;</span>
          <span>Version 1.0</span>
        </div>
      </header>

      <div className="legal-highlight legal-highlight--amber">
        <p>
          Claude Agent Template is an open-source software project released
          under the <strong>MIT License</strong>. These terms govern your use of
          the associated web service and account features &mdash; not the
          template code itself, which remains free and unrestricted.
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

      {/* 01 — Acceptance of Terms */}
      <section className="legal-section" id="s1">
        <h2>
          <span className="legal-sec-num">01</span> Acceptance of Terms
        </h2>
        <p>
          By accessing or using Claude Agent Template (the
          &ldquo;Service&rdquo;), you agree to be bound by these Terms of
          Service. If you do not agree to these terms, please do not use the
          Service.
        </p>
        <p>
          We reserve the right to modify these terms at any time. Changes will
          be posted with a new &ldquo;Last updated&rdquo; date. Continued use of
          the Service after changes constitutes acceptance.
        </p>
      </section>

      {/* 02 — Description of Service */}
      <section className="legal-section" id="s2">
        <h2>
          <span className="legal-sec-num">02</span> Description of Service
        </h2>
        <p>Claude Agent Template provides:</p>
        <ul>
          <li>
            An open-source template system for building AI-assisted software
            projects using Claude Code
          </li>
          <li>
            A web dashboard for managing projects, memory entries, and agent
            activity logs
          </li>
          <li>Community resources, documentation, and educational content</li>
          <li>
            Account features for saving preferences and tracking template usage
          </li>
        </ul>
        <p>
          The Service requires a valid Anthropic API subscription to use the
          underlying AI capabilities. We are not affiliated with Anthropic.
        </p>
      </section>

      {/* 03 — License Grant */}
      <section className="legal-section" id="s3">
        <h2>
          <span className="legal-sec-num">03</span> License Grant
        </h2>
        <p>
          The template code is released under the <strong>MIT License</strong>.
          You are free to use, copy, modify, merge, publish, distribute,
          sublicense, or sell copies of the template, subject to the MIT License
          conditions.
        </p>
        <p>
          Your account and dashboard access grants you a limited, non-exclusive,
          non-transferable license to use the web service features. This license
          does not include:
        </p>
        <ul>
          <li>Reselling or white-labeling the dashboard service itself</li>
          <li>Automated scraping or bulk data extraction</li>
          <li>Using the service to train competing AI models</li>
        </ul>
      </section>

      {/* 04 — User Responsibilities */}
      <section className="legal-section" id="s4">
        <h2>
          <span className="legal-sec-num">04</span> User Responsibilities
        </h2>
        <p>You agree to:</p>
        <ul>
          <li>Provide accurate information when creating your account</li>
          <li>Maintain the security of your account credentials</li>
          <li>Use the Service in compliance with all applicable laws</li>
          <li>
            Not use the Service to store or transmit harmful, illegal, or
            malicious content
          </li>
          <li>
            Not attempt to reverse-engineer or compromise the Service
            infrastructure
          </li>
        </ul>
        <p>
          You are solely responsible for any content you input into projects
          managed through the Service, and for compliance with Anthropic&rsquo;s
          usage policies when using Claude Code.
        </p>
      </section>

      {/* 05 — Intellectual Property */}
      <section className="legal-section" id="s5">
        <h2>
          <span className="legal-sec-num">05</span> Intellectual Property
        </h2>
        <p>
          The template code is MIT-licensed. All other Service components
          &mdash; including the dashboard interface, branding, documentation
          structure, and non-code content &mdash; remain the intellectual
          property of the Service owner.
        </p>
        <p>
          Content you create using the template (your code, your projects, your
          memory files) belongs entirely to you. We claim no ownership over your
          work product.
        </p>
      </section>

      {/* 06 — Disclaimers & Limitation of Liability */}
      <section className="legal-section" id="s6">
        <h2>
          <span className="legal-sec-num">06</span> Disclaimers &amp; Limitation
          of Liability
        </h2>
        <p>
          THE SERVICE IS PROVIDED <strong>&ldquo;AS IS&rdquo;</strong> WITHOUT
          WARRANTY OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, OR THAT DEFECTS WILL BE CORRECTED.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
          ARISING FROM YOUR USE OF THE SERVICE.
        </p>
        <p>
          This includes but is not limited to: data loss, project interruption,
          AI-generated code errors, security incidents, or lost profits. You use
          the Service at your own risk.
        </p>
      </section>

      {/* 07 — Termination */}
      <section className="legal-section" id="s7">
        <h2>
          <span className="legal-sec-num">07</span> Termination
        </h2>
        <p>
          You may delete your account at any time from Settings &rarr; Danger
          Zone. Upon deletion, your account data will be permanently removed
          within 30 days.
        </p>
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these terms, engage in abuse, or create security risks for other
          users.
        </p>
      </section>

      {/* 08 — Governing Law */}
      <section className="legal-section" id="s8">
        <h2>
          <span className="legal-sec-num">08</span> Governing Law
        </h2>
        <p>
          These terms shall be governed by and construed in accordance with the
          laws of Taiwan (R.O.C.), without regard to conflict of law principles.
          Any disputes shall be resolved in the courts of Taipei, Taiwan.
        </p>
      </section>

      {/* 09 — Contact */}
      <section className="legal-section" id="s9">
        <h2>
          <span className="legal-sec-num">09</span> Contact
        </h2>
        <p>For questions about these terms:</p>
        <div className="legal-contact">
          <p style={{ marginBottom: 6 }}>
            <strong>Claude Agent Template</strong>
          </p>
          <p style={{ marginBottom: 4 }}>
            GitHub:{" "}
            <a
              href="https://github.com/alexhsieh/claude-agent-template"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/alexhsieh/claude-agent-template
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
            YouTube:{" "}
            <a
              href="https://www.youtube.com/@alexhsieh"
              target="_blank"
              rel="noopener noreferrer"
            >
              @alexhsieh
            </a>
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}
