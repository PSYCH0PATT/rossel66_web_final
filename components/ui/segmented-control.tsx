"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Сегмент-переключатель («7Д / 30Д / 90Д / Год / Свой период») — C-07
 * (docs/ui-audit.md). Стиль — период-пилюли admin/analytics; единое
 * active-состояние вместо «то зелёный CAPS, то синий sentence-case» (F-22).
 * Подписи сегментов берите из PERIOD_STRINGS (lib/ui-strings) — не «Custom».
 */

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: React.ReactNode
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedControlOption<T>[]
  value: T
  onValueChange: (value: T) => void
  "aria-label"?: string
  className?: string
}

function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex rounded-xl border border-white/10 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "min-w-[max-content] rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors pointer-coarse:min-h-11",
            value === option.value
              ? "bg-brand/10 text-emerald-400"
              : "text-gray-500 hover:text-emerald-400"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export { SegmentedControl }
