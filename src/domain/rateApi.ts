export interface ExchangeRateResponse {
  rate: number
}

// Mock delay (300-1500ms) and error rate (15%) are part of the assignment
// spec — don't change them.
export function getExchangeRate(
  from: string,
  to: string,
): Promise<ExchangeRateResponse> {
  const delay = 300 + Math.random() * 1200
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.15) {
        reject(new Error("Rate service temporarily unavailable"))
        return
      }
      const seed = from.charCodeAt(0) + to.charCodeAt(0)
      const rate = 0.5 + (seed % 10) / 5
      resolve({ rate })
    }, delay)
  })
}
