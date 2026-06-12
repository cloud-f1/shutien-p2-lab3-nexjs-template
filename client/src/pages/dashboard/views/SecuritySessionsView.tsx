import { sessionsApi } from "../../../api/sessions";
import { useServiceMutation, useServiceQuery } from "../../../hooks/useService";
import { CACHE_TIERS } from "../../../cacheConfig";
import type { UserSessionRead } from "../../../schemas/auth";
import {
  Button,
  DataTable,
  PageContainer,
  type Column,
} from "../../../components/ui";

const SESSIONS_KEY = ["auth", "sessions"] as const;

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function truncateUserAgent(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  return ua.length > 64 ? `${ua.slice(0, 61)}...` : ua;
}

export default function SecuritySessionsView() {
  const sessionsQuery = useServiceQuery<UserSessionRead[]>(
    SESSIONS_KEY,
    () => sessionsApi.list(),
    CACHE_TIERS.STANDARD,
  );

  const revoke = useServiceMutation<void, string>(
    (id) => sessionsApi.revoke(id),
    { invalidateKeys: [SESSIONS_KEY] },
  );

  const logoutAll = useServiceMutation<void, void>(
    () => sessionsApi.logoutAll(),
    { invalidateKeys: [SESSIONS_KEY] },
  );

  const sessions = sessionsQuery.data ?? [];

  const columns: Column<UserSessionRead>[] = [
    {
      id: "id",
      header: "Session",
      accessor: (s) => <span title={s.id}>{s.id.slice(0, 8)}</span>,
      mono: true,
      width: "120px",
    },
    {
      id: "created_at",
      header: "Created",
      accessor: (s) => formatTimestamp(s.created_at),
      mono: true,
    },
    {
      id: "last_used_at",
      header: "Last used",
      accessor: (s) => formatTimestamp(s.last_used_at),
      mono: true,
    },
    {
      id: "ip",
      header: "IP",
      accessor: (s) => s.ip ?? "unknown",
      mono: true,
    },
    {
      id: "user_agent",
      header: "User agent",
      accessor: (s) => truncateUserAgent(s.user_agent),
      mono: true,
    },
  ];

  return (
    <PageContainer
      eyebrow="Security"
      title="Active Sessions"
      subtitle="Devices currently signed in to your account. Revoke any unfamiliar session to invalidate its refresh token immediately."
      actions={
        <Button
          variant="danger"
          size="sm"
          onClick={() => logoutAll.mutate()}
          loading={logoutAll.isPending}
        >
          {logoutAll.isPending ? "Signing out…" : "Sign out everywhere"}
        </Button>
      }
    >
      <DataTable
        data={sessions}
        columns={columns}
        getRowId={(s) => s.id}
        searchable
        searchPlaceholder="Search sessions"
        searchKeys={["id", "ip", "user_agent"]}
        pageSize={10}
        rowActions={(s) => [
          {
            label: "Revoke",
            ariaLabel: `Revoke session ${s.id.slice(0, 8)}`,
            variant: "danger",
            disabled: revoke.isPending,
            onClick: () => revoke.mutate(s.id),
          },
        ]}
        isLoading={sessionsQuery.isLoading}
        isError={sessionsQuery.isError}
        errorMessage="Failed to load sessions."
        emptyMessage="No active sessions."
        ariaLabel="Active sessions"
        toolbarTitle={`Sessions (${sessions.length})`}
      />
    </PageContainer>
  );
}
