export type RateFetchError =
  | { readonly _tag: "RateServiceUnavailable"; readonly message: string }
  | { readonly _tag: "RateInvalidResponse"; readonly message: string }
  | { readonly _tag: "UnknownError"; readonly message: string }

const SERVICE_UNAVAILABLE_MESSAGE = "Rate service temporarily unavailable"

export function toRateFetchError(err: unknown): RateFetchError {
  const message = err instanceof Error ? err.message : "Unknown error"
  if (message === SERVICE_UNAVAILABLE_MESSAGE) {
    return { _tag: "RateServiceUnavailable", message }
  }
  return { _tag: "UnknownError", message }
}

export function invalidResponseError(raw: unknown): RateFetchError {
  return { _tag: "RateInvalidResponse", message: `Invalid exchange rate response: ${JSON.stringify(raw)}` }
}
