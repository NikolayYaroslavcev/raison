import { Effect } from "effect"
import type { CurrencyCode } from "../domain/currency"
import type { RateFetchError } from "../domain/errors"
import { invalidResponseError, toRateFetchError } from "../domain/errors"
import type { ExchangeRateResponse } from "../domain/rateApi"
import { getExchangeRate } from "../domain/rateApi"

export function validateExchangeRateResponse(raw: unknown): ExchangeRateResponse | RateFetchError {
  const isValid =
    typeof raw === "object" &&
    raw !== null &&
    "rate" in raw &&
    typeof (raw as { rate: unknown }).rate === "number" &&
    Number.isFinite((raw as { rate: number }).rate) &&
    (raw as { rate: number }).rate > 0

  if (isValid) return raw as ExchangeRateResponse
  return invalidResponseError(raw)
}

export function getExchangeRateEffect(
  from: CurrencyCode,
  to: CurrencyCode,
): Effect.Effect<ExchangeRateResponse, RateFetchError> {
  return Effect.tryPromise({
    try: () => getExchangeRate(from, to),
    catch: toRateFetchError,
  }).pipe(
    Effect.flatMap((response) => {
      const validated = validateExchangeRateResponse(response)
      return "rate" in validated ? Effect.succeed(validated) : Effect.fail(validated)
    }),
  )
}
