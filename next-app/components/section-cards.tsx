import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon } from "lucide-react"

export interface SectionCardsProps {
  /** Total items owned by the current user (real). */
  totalItems: number
  /** Total registered users — only available to admins (real). */
  totalUsers?: number
  /** Verified users — only available to admins (real). */
  verifiedUsers?: number
}

export function SectionCards({
  totalItems,
  totalUsers,
  verifiedUsers,
}: SectionCardsProps) {
  const isAdminView = typeof totalUsers === "number"

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {/* Real: current user's item count */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Your Items</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalItems.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Items you own <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total items in your account
          </div>
        </CardFooter>
      </Card>

      {/* Real for admins: total users. Representative otherwise. */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            {isAdminView ? "Total Users" : "Active Accounts"}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isAdminView ? totalUsers!.toLocaleString() : "45,678"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              {isAdminView ? "Live" : "+12.5%"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isAdminView ? "Registered users" : "Strong user retention"}{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {isAdminView
              ? "All accounts in the system"
              : "Engagement exceeds targets"}
          </div>
        </CardFooter>
      </Card>

      {/* Real for admins: verified users. Representative otherwise. */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            {isAdminView ? "Verified Users" : "New Customers"}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isAdminView ? (verifiedUsers ?? 0).toLocaleString() : "1,234"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              {isAdminView ? "Live" : "+8.2%"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isAdminView ? "Email-verified accounts" : "Steady acquisition"}{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {isAdminView
              ? "Users who confirmed their email"
              : "Acquisition on track"}
          </div>
        </CardFooter>
      </Card>

      {/* Representative growth metric (visual only). */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance increase <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  )
}
