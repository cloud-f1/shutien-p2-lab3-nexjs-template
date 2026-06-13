import { getAllUsers } from "@/actions/admin"
import { requireAdmin } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import { RoleSelector } from "./_role-selector"
import { DeleteUserButton } from "./_delete-user-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin — Users" }

export default async function AdminPage() {
  const session = await requireAdmin()
  const users = await getAllUsers()

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} total users</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>
                <RoleSelector
                  userId={user.id}
                  currentRole={user.role}
                  isSelf={user.id === session.user.id}
                />
              </TableCell>
              <TableCell>
                {user.emailVerified ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">Yes</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">No</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {user.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                {user.id !== session.user.id && (
                  <DeleteUserButton userId={user.id} email={user.email} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
