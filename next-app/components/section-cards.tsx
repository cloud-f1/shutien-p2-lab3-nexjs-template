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
          <CardDescription>您的項目</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalItems.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              即時
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            您擁有的項目 <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            您帳戶中的項目總數
          </div>
        </CardFooter>
      </Card>

      {/* Real for admins: total users. Representative otherwise. */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            {isAdminView ? "使用者總數" : "活躍帳戶"}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isAdminView ? totalUsers!.toLocaleString() : "45,678"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              {isAdminView ? "即時" :"+12.5%"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isAdminView ? "已註冊使用者" : "使用者留存率高"}{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {isAdminView
              ? "系統中的所有帳戶"
              : "參與度超出目標"}
          </div>
        </CardFooter>
      </Card>

      {/* Real for admins: verified users. Representative otherwise. */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            {isAdminView ? "已驗證使用者" : "新客戶"}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isAdminView ? (verifiedUsers ?? 0).toLocaleString() : "1,234"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon />
              {isAdminView ? "即時" :"+8.2%"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isAdminView ? "已驗證電子郵件的帳戶" : "穩定獲客"}{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {isAdminView
              ? "已確認電子郵件的使用者"
              : "獲客進度正常"}
          </div>
        </CardFooter>
      </Card>

      {/* Representative growth metric (visual only). */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>成長率</CardDescription>
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
            績效穩定成長 <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">符合成長預期</div>
        </CardFooter>
      </Card>
    </div>
  )
}
