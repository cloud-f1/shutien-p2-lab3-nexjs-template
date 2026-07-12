"use client"

import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface VideoDemoProps {
  /**
   * "modal" (default, homepage behavior) — a button that opens a placeholder
   * player in a Dialog. "inline" (E326 sales-page hook video) — an
   * always-visible, fixed-aspect-ratio autoplaying video block.
   */
  mode?: "modal" | "inline"
  /** Video source — omit to fall back to the aurora placeholder block. */
  src?: string
  poster?: string
  /** WebVTT captions track — rendered as a <track kind="captions"> slot. */
  captionsSrc?: string
  captionsLabel?: string
  className?: string
}

function AuroraPlaceholder() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora-blob b1" />
      <div className="aurora-blob b2" />
    </div>
  )
}

/**
 * "Watch demo" trigger (homepage) → modal player, OR (E326) a below-the-fold
 * inline hook video: muted autoplay + loop + captions slot + poster, fixed
 * aspect-video ratio (no CLS). Same component — enhanced, not forked.
 */
export function VideoDemo({
  mode = "modal",
  src,
  poster,
  captionsSrc,
  captionsLabel = "中文字幕",
  className,
}: VideoDemoProps) {
  if (mode === "inline") {
    return (
      <div
        className={cn(
          "bg-muted relative aspect-video w-full overflow-hidden rounded-2xl border shadow-lg",
          className,
        )}
      >
        {src ? (
          <video
            className="size-full object-cover"
            muted
            autoPlay
            playsInline
            loop
            preload="metadata"
            poster={poster}
          >
            <source src={src} />
            {captionsSrc && (
              <track kind="captions" src={captionsSrc} srcLang="zh-TW" label={captionsLabel} default />
            )}
          </video>
        ) : (
          <AuroraPlaceholder />
        )}
      </div>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <Play className="size-4" /> 看示範
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>產品示範</DialogTitle>
          <DialogDescription>互動式導覽 —— 正式影片即將推出。</DialogDescription>
        </DialogHeader>
        <div className="bg-muted relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border">
          <AuroraPlaceholder />
          <span className="bg-background/80 relative z-10 flex size-16 items-center justify-center rounded-full border shadow-lg backdrop-blur">
            <Play className="text-primary size-7" />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
