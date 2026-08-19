import { describe, it, expect, vi, afterEach } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ExchangeRateResponse } from "./domain/rateApi"
import { CurrencyExchangeWidget } from "./CurrencyExchangeWidget"

const { getExchangeRateMock } = vi.hoisted(() => ({
  getExchangeRateMock: vi.fn(),
}))

vi.mock("./domain/rateApi", () => ({
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
  cleanup()
  getExchangeRateMock.mockReset()
})

describe("CurrencyExchangeWidget", () => {
  it("keeps the result of the latest request even when an earlier request resolves later (race condition)", async () => {
    // #0 on mount, #1 after switching To -> BTC, #2 after switching back to
    // EUR, so #0 and #2 target the same pair — this exercises the Fiber
    // interrupt guard in useExchangeRate, not just a from/to mismatch check.
    const requests: ReturnType<typeof deferred<ExchangeRateResponse>>[] = []
    getExchangeRateMock.mockImplementation(() => {
      const request = deferred<ExchangeRateResponse>()
      requests.push(request)
      return request.promise
    })

    render(<CurrencyExchangeWidget />)
    expect(getExchangeRateMock).toHaveBeenCalledTimes(1)

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText("To"), "BTC")
    expect(getExchangeRateMock).toHaveBeenCalledTimes(2)

    await user.selectOptions(screen.getByLabelText("To"), "EUR")
    expect(getExchangeRateMock).toHaveBeenCalledTimes(3)

    // The later request (#2) resolves first.
    requests[2].resolve({ rate: 5 })
    expect(await screen.findByText(/Курс: 1 USD = 5 EUR/)).toBeInTheDocument()

    // The stale #0 request resolves after it, for the same currency pair.
    await act(async () => {
      requests[0].resolve({ rate: 99 })
      await requests[0].promise
    })

    expect(screen.getByText(/Курс: 1 USD = 5 EUR/)).toBeInTheDocument()
    expect(screen.queryByText(/Курс: 1 USD = 99 EUR/)).not.toBeInTheDocument()
  })

  it("disables Обменять for zero amount or matching currencies, enables it once a valid rate arrives", async () => {
    getExchangeRateMock.mockResolvedValue({ rate: 1.5 })
    const user = userEvent.setup()
    render(<CurrencyExchangeWidget />)

    const exchangeButton = screen.getByRole("button", { name: "Обменять" })

    await user.type(screen.getByLabelText("Amount"), "0")
    await waitFor(() => expect(exchangeButton).toBeDisabled())

    await user.clear(screen.getByLabelText("Amount"))
    await user.type(screen.getByLabelText("Amount"), "100")
    await user.selectOptions(screen.getByLabelText("To"), "USD")
    await waitFor(() => expect(exchangeButton).toBeDisabled())

    await user.selectOptions(screen.getByLabelText("To"), "EUR")
    await waitFor(() => expect(exchangeButton).toBeEnabled())
    expect(await screen.findByText(/100 USD × 1\.5 = 150 EUR/)).toBeInTheDocument()
  })

  it("shows an error with a Retry button, then recovers after a successful retry", async () => {
    const first = deferred<ExchangeRateResponse>()
    const second = deferred<ExchangeRateResponse>()
    getExchangeRateMock.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)

    render(<CurrencyExchangeWidget />)
    expect(getExchangeRateMock).toHaveBeenCalledTimes(1)

    first.reject(new Error("Rate service temporarily unavailable"))

    expect(await screen.findByText(/Сервис курсов временно недоступен/)).toBeInTheDocument()
    const retryButton = screen.getByRole("button", { name: "Повторить" })

    const user = userEvent.setup()
    await user.click(retryButton)

    expect(getExchangeRateMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/Сервис курсов временно недоступен/)).not.toBeInTheDocument()
    expect(screen.getByText(/Получаем курс/)).toBeInTheDocument()

    second.resolve({ rate: 3 })

    expect(await screen.findByText(/Курс: 1 USD = 3 EUR/)).toBeInTheDocument()
    expect(screen.queryByText(/Сервис курсов временно недоступен/)).not.toBeInTheDocument()
  })
})
