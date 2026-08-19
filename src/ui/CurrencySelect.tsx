import type { CurrencyCode } from "../domain/currency"

export interface CurrencySelectProps {
  id: string
  label: string
  value: CurrencyCode
  options: readonly CurrencyCode[]
  onChange: (value: CurrencyCode) => void
}

export function CurrencySelect({ id, label, value, options, onChange }: CurrencySelectProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as CurrencyCode)}>
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  )
}
