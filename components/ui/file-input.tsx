"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { plural } from "@/lib/plural"

/**
 * Выбор файла кнопкой из ui/button — C-17 (docs/ui-audit.md). Замена нативным
 * `<input type="file">`, которые выпадали из тёмной темы (F-12): сам input
 * визуально скрыт, но остаётся в DOM и фокусируем.
 */

export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onFilesChange?: (files: File[]) => void
  buttonLabel?: React.ReactNode
  /** Текст при пустом выборе. */
  emptyLabel?: React.ReactNode
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  containerClassName?: string
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  (
    {
      onFilesChange,
      buttonLabel = "Выбрать файл",
      emptyLabel = "Файл не выбран",
      buttonVariant = "outline",
      containerClassName,
      className,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null)
    const [fileNames, setFileNames] = React.useState<string[]>([])

    return (
      <div className={cn("flex min-w-0 items-center gap-3", containerClassName)}>
        <Button
          type="button"
          variant={buttonVariant}
          disabled={disabled}
          onClick={() => innerRef.current?.click()}
        >
          <span className="material-symbols-outlined" aria-hidden>
            upload_file
          </span>
          {buttonLabel}
        </Button>
        <span className="min-w-0 truncate font-mono text-xs text-gray-500">
          {fileNames.length === 0
            ? emptyLabel
            : fileNames.length === 1
              ? fileNames[0]
              : `${fileNames.length} ${plural(fileNames.length, ["файл", "файла", "файлов"])}`}
        </span>
        <input
          {...props}
          id={id}
          ref={(node) => {
            innerRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
          }}
          type="file"
          disabled={disabled}
          className={cn("sr-only", className)}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            setFileNames(files.map((f) => f.name))
            onFilesChange?.(files)
          }}
        />
      </div>
    )
  }
)
FileInput.displayName = "FileInput"

export { FileInput }
