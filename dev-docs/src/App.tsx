import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

const MarkdownContent = lazy(() =>
  import("./components/MarkdownContent").then((m) => ({
    default: m.MarkdownContent,
  })),
);
const LandingPage = lazy(() => import("./pages/LandingPage"));

function useIsLandingRoute() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => {
      const h = window.location.hash;
      return h === "#/landing" || h.startsWith("#/landing/");
    },
    () => false,
  );
}

function DocsView() {
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}DEVELOPER_DOCS.md`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(setMarkdown)
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <div
        className="h-screen flex items-center justify-center flex-col gap-2"
        style={{ background: "var(--bg)", color: "var(--red)" }}
      >
        <p>Failed to load DEVELOPER_DOCS.md</p>
        <p className="text-sm" style={{ color: "var(--text3)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!markdown) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--text2)" }}
      >
        Loading docs...
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Header />
      <div className="flex mt-14 min-h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <MarkdownContent markdown={markdown} />
      </div>
    </ThemeProvider>
  );
}

export default function App() {
  const isLanding = useIsLandingRoute();
  return (
    <Suspense
      fallback={
        <div
          className="h-screen flex items-center justify-center"
          style={{ background: "var(--bg)", color: "var(--text2)" }}
        >
          Loading...
        </div>
      }
    >
      {isLanding ? <LandingPage /> : <DocsView />}
    </Suspense>
  );
}
