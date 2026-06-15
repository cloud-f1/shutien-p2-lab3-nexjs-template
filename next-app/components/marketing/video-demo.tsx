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

/** Hero "Watch demo" → modal player (styled placeholder; wire a real asset later). */
export function VideoDemo() {
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
          <div className="aurora" aria-hidden="true">
            <div className="aurora-blob b1" />
            <div className="aurora-blob b2" />
          </div>
          <span className="bg-background/80 relative z-10 flex size-16 items-center justify-center rounded-full border shadow-lg backdrop-blur">
            <Play className="text-primary size-7" />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
