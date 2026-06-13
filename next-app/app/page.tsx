import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">專案已就緒！</h1>
          <p>您現在可以新增元件並開始開發。</p>
          <p>我們已經為您加入按鈕元件。</p>
          <Button className="mt-2">按鈕</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          （按 <kbd>d</kbd> 切換深色模式）
        </div>
      </div>
    </div>
  )
}
