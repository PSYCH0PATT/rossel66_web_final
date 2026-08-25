"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Тёмный date-picker — C-17 (docs/ui-audit.md). Вынесенный стиль пикеров
 * admin/artist analytics (Popover + Calendar + стеклянная outline-кнопка,
 * инвентаризация #14) — замена нативным `<input type="date">`, которые
 * выпадали из тёмной темы (F-12). Дата подписи — локальная, как в
 * analytics: календарь отдаёт локальную полночь.
 */

export interface DatePickerProps {
  value?: Date
  onChange: (date?: Date) => void
  /** Подпись пустого значения («ОТ», «ДО», «Дата»). */
  placeholder?: React.ReactNode
  disabled?: boolean
  align?: "start" | "center" | "end"
  className?: string
  id?: string
}

function DatePicker({
  value,
  onChange,
  placeholder = "Дата",
  disabled,
  align = "start",
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 border border-white/5 bg-surface-raised/60 text-xs uppercase text-gray-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)] backdrop-blur-xl",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3 w-3" />
          {value ? value.toLocaleDateString("ru-RU") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
