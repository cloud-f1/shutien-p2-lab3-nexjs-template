import { useScrollSpy } from "../hooks/useScrollSpy";

interface NavItem {
  id: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Getting Started",
    items: [
      { id: "1-architecture-overview", label: "概覽 Overview" },
      { id: "2-project-structure", label: "專案結構" },
      { id: "3-quick-start", label: "快速啟動 Quickstart" },
    ],
  },
  {
    label: "前端 Frontend",
    items: [
      { id: "41-tech-stack", label: "Tech Stack" },
      { id: "42-auth-flow--token-strategy", label: "Auth Flow" },
      { id: "43-4-tier-cache-strategy", label: "Cache Strategy" },
      { id: "44-api-client--interceptors", label: "API Client" },
      { id: "45-testing-vitest--msw", label: "Testing" },
    ],
  },
  {
    label: "後端 Backend",
    items: [
      { id: "51-tech-stack", label: "Tech Stack" },
      { id: "52-api-endpoints", label: "API Design" },
      { id: "53-database-design", label: "Database" },
      { id: "54-security-architecture", label: "Security" },
      { id: "55-testing-pytest", label: "Testing" },
    ],
  },
  {
    label: "工作流 Workflow",
    items: [
      { id: "6-openapi--shared-contract", label: "OpenAPI Contract" },
      { id: "7-development-workflow--sdd--tdd", label: "SDD + TDD" },
    ],
  },
  {
    label: "AI Agent System",
    items: [
      { id: "10-ai-agent-team", label: "6 Agents" },
      { id: "11-memory-system", label: "Memory System" },
      { id: "claude-code-快速指令", label: "Commands" },
    ],
  },
  {
    label: "Deployment",
    items: [
      { id: "8-environment-variables", label: "Env Variables" },
      { id: "9-deployment--zeabur", label: "Zeabur Deploy" },
      { id: "12-track-roadmap", label: "Roadmap" },
    ],
  },
  {
    label: "Changelog",
    items: [{ id: "13-changelog", label: "Changelog" }],
  },
];

const ALL_IDS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

export function Sidebar() {
  const activeId = useScrollSpy(ALL_IDS);

  return (
    <aside
      className="w-[260px] shrink-0 fixed top-14 bottom-0 left-0 overflow-y-auto py-6 pb-10 hidden md:block"
      style={{
        background: "var(--bg)",
        borderRight: "1px solid var(--border)",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border2) transparent",
      }}
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-2">
          <div
            className="text-[10px] font-semibold tracking-wider uppercase px-5 pt-2 pb-1 font-heading"
            style={{ color: "var(--text3)" }}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 px-5 py-1.5 text-[13.5px] no-underline transition-all leading-snug"
                style={{
                  color: isActive ? "var(--accent2)" : "var(--text2)",
                  borderLeft: isActive
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  background: isActive ? "rgba(240,165,0,0.06)" : "transparent",
                }}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{
                    background: isActive ? "var(--accent)" : "var(--border2)",
                  }}
                />
                {item.label}
              </a>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
