import { useEffect, useState } from "react"
import type { CurrencyCode } from "./domain/currency"
import { toMoney } from "./domain/currency"
import type { RateFetchError } from "./domain/errors"
import { useExchangeRate } from "./useExchangeRate"
import { CurrencySelect } from "./ui/CurrencySelect"
import { AmountInput } from "./ui/AmountInput"
import "./CurrencyExchangeWidget.css"

const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "BTC", "USDT"]
const AMOUNT_DEBOUNCE_MS = 350

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 })
}

function toUserMessage(error: RateFetchError): string {
  switch (error._tag) {
    case "RateServiceUnavailable":
      return "Сервис курсов временно недоступен. Попробуйте ещё раз."
    case "RateInvalidResponse":
      return "Получен некорректный ответ от сервиса курсов. Попробуйте ещё раз."
    case "UnknownError":
      return "Не удалось получить курс. Попробуйте ещё раз."
  }
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function CurrencyExchangeWidget() {
  // String, not number: an empty input must stay "" instead of becoming 0.
  const [amountInput, setAmountInput] = useState("")
  const [from, setFrom] = useState<CurrencyCode>("USD")
  const [to, setTo] = useState<CurrencyCode>("EUR")

  const debouncedAmountInput = useDebouncedValue(amountInput, AMOUNT_DEBOUNCE_MS)

  const { state: rateState, retry } = useExchangeRate(from, to)

  const parsedAmount = debouncedAmountInput.trim() === "" ? null : Number(debouncedAmountInput)
  const numericAmount =
    parsedAmount !== null && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? toMoney(parsedAmount)
      : null

  // Guards against the one-tick gap where React has already re-rendered
  // with the new from/to but useExchangeRate's effect hasn't flipped to
  // "loading" yet, so `data` would still belong to the previous pair.
  const isRateFresh =
    rateState.status === "success" && rateState.data.from === from && rateState.data.to === to

  const sameCurrency = from === to
  const canExchange = numericAmount !== null && !sameCurrency && isRateFresh

  return (
    <div className="exchange-widget">
      <AmountInput id="amount" label="Amount" value={amountInput} onChange={setAmountInput} />

      <div className="field-row">
        <CurrencySelect id="from" label="From" value={from} options={CURRENCIES} onChange={setFrom} />
        <CurrencySelect id="to" label="To" value={to} options={CURRENCIES} onChange={setTo} />
      </div>

      <div className="status" role="status">
        {rateState.status === "loading" && <p className="status-loading">Получаем курс…</p>}

        {rateState.status === "error" && (
          <p className="status-error">
            {toUserMessage(rateState.error)}{" "}
            <button type="button" className="retry-button" onClick={retry}>
              Повторить
            </button>
          </p>
        )}

        {isRateFresh &&
          (numericAmount !== null ? (
            <p className="status-success">
              {formatNumber(numericAmount)} {from} × {formatNumber(rateState.data.rate)} ={" "}
              {formatNumber(numericAmount * rateState.data.rate)} {to}
            </p>
          ) : (
            <p className="status-hint">
              Курс: 1 {from} = {formatNumber(rateState.data.rate)} {to}. Введите сумму больше 0.
            </p>
          ))}
      </div>

      {sameCurrency && <p className="hint">Выберите разные валюты, чтобы совершить обмен.</p>}

      <button type="button" className="exchange-button" disabled={!canExchange}>
        Обменять
      </button>
    </div>
  )
}
