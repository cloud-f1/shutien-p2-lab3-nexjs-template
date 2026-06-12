import { Link } from "react-router-dom";
import LogoMark from "../../components/LogoMark";
import { Footer, NavBar, Prose, PublicLayout } from "../../components/ui";

interface LegalLayoutProps {
  children: React.ReactNode;
}

/**
 * Wrapper for `/privacy` and `/terms`. Composes the public-surface
 * primitives (PublicLayout + NavBar + Prose + Footer). The page-level
 * content is rendered inside `<Prose>` for typography defaults.
 */
export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <PublicLayout
      nav={
        <NavBar
          ariaLabel="Site navigation"
          brand={<LogoMark size={22} />}
          brandText="CLAUDE AGENT TEMPLATE"
          brandRender={(cls) => (
            <Link to="/" className={cls}>
              <LogoMark size={22} />
              <span>CLAUDE AGENT TEMPLATE</span>
            </Link>
          )}
          links={[
            {
              label: "← Back to home",
              href: "/",
              render: (cls) => (
                <Link to="/" className={cls}>
                  ← Back to home
                </Link>
              ),
            },
          ]}
        />
      }
      footer={
        <Footer
          brand="Claude Agent Template · Built by"
          brandHandle="@alexhsieh"
          links={[
            {
              label: "Home",
              href: "/",
              render: (cls) => (
                <Link to="/" className={cls}>
                  Home
                </Link>
              ),
            },
            {
              label: "Privacy Policy",
              href: "/privacy",
              render: (cls) => (
                <Link to="/privacy" className={cls}>
                  Privacy Policy
                </Link>
              ),
            },
            {
              label: "Terms of Service",
              href: "/terms",
              render: (cls) => (
                <Link to="/terms" className={cls}>
                  Terms of Service
                </Link>
              ),
            },
          ]}
        />
      }
    >
      <Prose>{children}</Prose>
    </PublicLayout>
  );
}
