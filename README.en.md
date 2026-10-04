# Currency Exchange Widget: reference solution

[Русский](README.md) · **English**

A currency exchange form (`Amount` + `From`/`To`, the rate comes from a mock API, result =
`amount × rate`). A reference solution to a test assignment (Raison, Frontend
Developer) built with Effect-TS.

## Architecture

```
CurrencyExchangeWidget (container)
        │  uses
        ▼
useExchangeRate (React hook — a thin adapter)
        │  runs
        ▼
Effect Data Layer — src/data/exchangeRate.ts
        │  adapts
        ▼
rateApi (typed Promise-based API contract) — src/domain/rateApi.ts
```

- **`src/domain/`**: types (`CurrencyCode`, `Money` as a branded type,
  `RequestState` as a discriminated union), typed errors
  (`RateFetchError`) and the API contract (`ExchangeRateResponse` + the mock
  `getExchangeRate`).
- **`src/data/exchangeRate.ts`**: the Effect Data Layer, the only place
  that calls `getExchangeRate`. It wraps the Promise in
  `Effect.tryPromise`, validates the shape of the response and turns both
  transport and validation errors into the same `RateFetchError`.
- **`src/useExchangeRate.ts`**: the React hook. It runs the Effect from the data layer
  as a `Fiber`, converts the result into a `RequestState`
  (`idle`/`loading`/`success`/`error`) and interrupts the Fiber in cleanup. `retry`
  restarts the same effect through a `retryToken` in the dependencies.
- **`src/ui/`** (`CurrencySelect`, `AmountInput`): presentational components
  with no dependency on `rateApi`/`effect`/`useExchangeRate`.
- **`src/CurrencyExchangeWidget.tsx`**: the container, which assembles the UI +
  `useExchangeRate`, calculates `amount × rate` and manages validation of the
  "Exchange" button (amount > 0, different currencies, a fresh successful rate).

## Race condition: `ignore` flag vs Effect Fiber interruption

The classic React solution is a boolean `ignore` flag in cleanup. The request
keeps running in the background, but the stale result is simply not written to
state.

Here, instead, every request is a managed `Fiber` (`Effect.runFork`)
that gets `Fiber.interruptFork` on the next run of the effect or on
unmount: a stale Fiber physically never reaches
`onSuccess`/`onFailure`. A caveat: the mock `Promise` inside
`Effect.tryPromise` is not abortable (a plain `setTimeout`), so the timer
still runs out. Interruption stops the handling of the result,
not the network request.

The regression test is `keeps the result of the latest request...` in
`src/CurrencyExchangeWidget.test.tsx`. If you remove `Fiber.interruptFork` from the
cleanup in `useExchangeRate.ts`, the test starts failing.

## Types

- `Money`: a branded `number` (`number & { readonly __brand: "Money" }`),
  which requires an explicit `toMoney()`.
- `RequestState<TData, TError>`: a discriminated union instead of boolean
  flags (`isLoading`/`isError`/...).
- `RateFetchError`: a discriminated union on `_tag`
  (`RateServiceUnavailable` / `RateInvalidResponse` / `UnknownError`),
  valid both as a regular TS union and as an Effect error channel.

## Tests (Vitest + Testing Library)

- `src/CurrencyExchangeWidget.test.tsx`: end-to-end, covers the race condition,
  validation of the "Exchange" button, error + Retry.
- `src/data/exchangeRate.test.ts`: the Effect Data Layer in isolation: success,
  transport error, validation error, Fiber interruption.

```
npm run test    # vitest run
npm run build   # tsc -b && vite build
```

## What would be added when moving to a real project

Retry with exponential backoff, a rate cache (with TTL), a real API contract with
400/422/503 codes, i18n for amounts and number formatting.
