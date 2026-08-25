import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

/**
 * Обёртка поля формы — C-17 (docs/ui-audit.md). Правило «у поля всегда
 * label» (F-82: placeholder-only поля треков): label здесь обязательный
 * проп. Стиль подписи — канонический админский (font-mono uppercase
 * text-gray-400), как в диалогах releases/analytics.
 */

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  /** id контрола внутри — связывает label с полем. */
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, htmlFor, hint, error, required, className, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      <Label
        htmlFor={htmlFor}
        // block: иначе label инлайновый и встаёт в строку с инлайновыми
        // контролами (кнопка DatePicker/FileInput).
        className="block font-mono text-xs uppercase tracking-wider text-gray-400"
      >
        {label}
        {required && (
          <span className="text-status-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
)
FormField.displayName = "FormField"

export { FormField }
