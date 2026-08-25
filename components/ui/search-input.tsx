"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Поиск с иконкой и кнопкой очистки — C-08 (docs/ui-audit.md). Единая замена
 * raw-поисков admin-releases/admin-artists/profile-filter. Дебаунс остаётся
 * на странице: компонент только контролируемое поле.
 */

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string
  onValueChange: (value: string) => void
  /** Класс внешней обёртки (ширина/отступы); className уходит на input. */
  containerClassName?: string
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onValueChange,
      containerClassName,
      className,
      placeholder = "Поиск…",
      ...props
    },
    ref
  ) => (
    <div className={cn("group relative h-10 w-full max-md:h-11 pointer-coarse:h-11", containerClassName)}>
      <input
        ref={ref}
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-full w-full rounded-lg border border-white/10 bg-black/40 py-0 pl-10 pr-9 font-mono text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-brand focus:ring-1 focus:ring-brand/30 group-hover:border-white/15",
          className
        )}
        {...props}
      />
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-hover:text-gray-400"
        aria-hidden
      >
        <span className="material-symbols-outlined text-lg leading-none">search</span>
      </span>
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-gray-500 transition-colors hover:text-white"
          aria-label="Очистить поиск"
        >
          <span className="material-symbols-outlined text-lg leading-none" aria-hidden>
            close
          </span>
        </button>
      )}
    </div>
  )
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
