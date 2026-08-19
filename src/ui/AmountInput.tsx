export interface AmountInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

export function AmountInput({ id, label, value, onChange }: AmountInputProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
