import { describe, it, expect, vi, afterEach } from "vitest"
import { Effect, Exit, Fiber } from "effect"
import { getExchangeRateEffect, validateExchangeRateResponse } from "./exchangeRate"

const { getExchangeRateMock } = vi.hoisted(() => ({
  getExchangeRateMock: vi.fn(),
}))

vi.mock("../domain/rateApi", () => ({
  getExchangeRate: getExchangeRateMock,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  getExchangeRateMock.mockReset()
})

describe("validateExchangeRateResponse", () => {
  it("accepts a well-formed response", () => {
    const result = validateExchangeRateResponse({ rate: 1.5 })
    expect(result).toEqual({ rate: 1.5 })
  })

  it("rejects a response with a non-numeric rate as a typed RateInvalidResponse error", () => {
    const result = validateExchangeRateResponse({ rate: "1.5" })
    expect(result).toMatchObject({ _tag: "RateInvalidResponse" })
  })

  it("rejects a response with a non-positive rate", () => {
    const result = validateExchangeRateResponse({ rate: 0 })
    expect(result).toMatchObject({ _tag: "RateInvalidResponse" })
  })

  it("rejects a malformed shape (missing rate field)", () => {
    const result = validateExchangeRateResponse({})
    expect(result).toMatchObject({ _tag: "RateInvalidResponse" })
  })
})

describe("getExchangeRateEffect", () => {
  it("succeeds with the expected response when the underlying Promise resolves", async () => {
    getExchangeRateMock.mockResolvedValue({ rate: 2.5 })

    const result = await Effect.runPromise(getExchangeRateEffect("USD", "EUR"))

    expect(result).toEqual({ rate: 2.5 })
  })

  it("turns a rejected Promise into a typed RateFetchError, not a raw Error/unknown", async () => {
    getExchangeRateMock.mockRejectedValue(new Error("Rate service temporarily unavailable"))

    const error = await Effect.runPromise(Effect.flip(getExchangeRateEffect("USD", "EUR")))

    expect(error).toMatchObject({ _tag: "RateServiceUnavailable" })
  })

  it("turns a malformed (but successfully resolved) response into a typed domain error", async () => {
    getExchangeRateMock.mockResolvedValue({ rate: "not-a-number" })

    const error = await Effect.runPromise(Effect.flip(getExchangeRateEffect("USD", "EUR")))

    expect(error).toMatchObject({ _tag: "RateInvalidResponse" })
  })

  it("an interrupted Fiber never reaches success/failure handlers, even after the underlying Promise resolves", async () => {
    const request = deferred<{ rate: number }>()
    getExchangeRateMock.mockImplementation(() => request.promise)

    const onSuccess = vi.fn()
    const onFailure = vi.fn()

    const fiber = Effect.runFork(
      Effect.matchEffect(getExchangeRateEffect("USD", "EUR"), {
        onFailure: (error) => Effect.sync(() => onFailure(error)),
        onSuccess: (data) => Effect.sync(() => onSuccess(data)),
      }),
    )

    const exit = await Effect.runPromise(Fiber.interrupt(fiber))
    expect(Exit.isInterrupted(exit)).toBe(true)

    request.resolve({ rate: 42 })
    await request.promise

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFailure).not.toHaveBeenCalled()
  })
})
