export type CurrencyCode = "USD" | "EUR" | "BTC" | "USDT"

// Branded type: requires an explicit toMoney() so a raw number (index,
// percentage, ...) can't be passed where a validated amount is expected.
export type Money = number & { readonly __brand: "Money" }

export function toMoney(value: number): Money {
  return value as Money
}

export type RequestState<TData, TError = string> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: TError }
