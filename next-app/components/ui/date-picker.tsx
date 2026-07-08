"use client"

// E323 — Date picker: a Calendar inside a Popover, triggered by a Button that shows the
// selected date. Controlled via `value` / `onChange`. Composes the shadcn calendar +
// popover + button primitives (no new dependency beyond react-day-picker + date-fns).
import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  /** Disable individual days (passed straight to the calendar). */
  disabled?: React.ComponentProps<typeof Calendar>["disabled"]
  className?: string
  /** date-fns format string for the trigger label (default "PPP"). */
  displayFormat?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  displayFormat = "PPP",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, displayFormat) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
          disabled={disabled}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
