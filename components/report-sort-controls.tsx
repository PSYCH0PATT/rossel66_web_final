"use client"

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Совпадает с белым списком в lib/report-sort — сервер молча игнорирует всё остальное. */
export type SortField =
  | "artistName"
  | "year"
  | "quarter"
  | "uploadedAt"
  | "acknowledgedAt"
  | "totalPlays"
  | "totalAmount"
  | "isAcknowledged"
  | "isSigned"
  | "isPaid"

export type SortState = { sort: SortField; dir: "asc" | "desc" }

const LABELS: Record<SortField, string> = {
  artistName: "Артист",
  year: "Год",
  quarter: "Квартал",
  uploadedAt: "Дата загрузки",
  acknowledgedAt: "Дата ознакомления",
  totalPlays: "Прослушивания",
  totalAmount: "Сумма",
  isAcknowledged: "Ознакомлен",
  isSigned: "Подписан",
  isPaid: "Выплачен",
}

type Props = {
  value: SortState
  onChange: (next: SortState) => void
  /** Какие поля показывать и в каком порядке. */
  fields: SortField[]
  disabled?: boolean
}

export function ReportSortControls({ value, onChange, fields, disabled }: Props) {
  const dirLabel = value.dir === "asc" ? "По возрастанию" : "По убыванию"

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="hidden text-xs uppercase tracking-widest text-slate-400 sm:inline">Сортировка</span>
      <Select
        value={value.sort}
        onValueChange={(v) => onChange({ ...value, sort: v as SortField })}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-[170px] border-slate-600 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field} value={field}>
              {LABELS[field]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        title={dirLabel}
        aria-label={dirLabel}
        onClick={() => onChange({ ...value, dir: value.dir === "asc" ? "desc" : "asc" })}
      >
        {value.dir === "asc" ? (
          <ArrowUpNarrowWide className="h-4 w-4" />
        ) : (
          <ArrowDownWideNarrow className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
