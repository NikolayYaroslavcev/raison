import { useCallback, useEffect, useState } from "react"
import { Effect, Fiber } from "effect"
import type { CurrencyCode, RequestState } from "./domain/currency"
import type { RateFetchError } from "./domain/errors"
import { getExchangeRateEffect } from "./data/exchangeRate"

export interface ExchangeRateData {
  rate: number
  from: CurrencyCode
  to: CurrencyCode
}

export type ExchangeRateRequestState = RequestState<ExchangeRateData, RateFetchError>

export interface UseExchangeRateResult {
  readonly state: ExchangeRateRequestState
  readonly retry: () => void
}

export function useExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode,
): UseExchangeRateResult {
  const [state, setState] = useState<ExchangeRateRequestState>({ status: "idle" })

  // Bumping this re-runs the effect below to retry the current from/to pair,
  // reusing the exact same fetch + Fiber-guard path (no separate retry code).
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    setState({ status: "loading" })

    const program = getExchangeRateEffect(from, to)

    const fiber = Effect.runFork(
      Effect.matchEffect(program, {
        onFailure: (error) => Effect.sync(() => setState({ status: "error", error })),
        onSuccess: (data) =>
          Effect.sync(() => setState({ status: "success", data: { rate: data.rate, from, to } })),
      }),
    )

    // Interrupts the previous Fiber before it can reach onSuccess/onFailure —
    // a stale response never gets a chance to overwrite a newer one,
    // regardless of which network response actually lands first.
    return () => {
      Effect.runSync(Fiber.interruptFork(fiber))
    }
  }, [from, to, retryToken])

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  return { state, retry }
}
