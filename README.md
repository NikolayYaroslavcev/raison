# Currency Exchange Widget: reference solution

**Русский** · [English](README.en.md)

Форма обмена валют (`Amount` + `From`/`To`, курс через мок API, результат =
`amount × rate`). Эталонное решение тестового задания (Raison, Frontend
Developer) на Effect-TS.

## Архитектура

```
CurrencyExchangeWidget (container)
        │  uses
        ▼
useExchangeRate (React hook — тонкий adapter)
        │  runs
        ▼
Effect Data Layer — src/data/exchangeRate.ts
        │  adapts
        ▼
rateApi (typed Promise-based API contract) — src/domain/rateApi.ts
```

- **`src/domain/`**: типы (`CurrencyCode`, `Money` как branded type,
  `RequestState` как discriminated union), типизированные ошибки
  (`RateFetchError`) и API-контракт (`ExchangeRateResponse` + мок
  `getExchangeRate`).
- **`src/data/exchangeRate.ts`**: Effect Data Layer, единственное место,
  которое вызывает `getExchangeRate`. Оборачивает Promise в
  `Effect.tryPromise`, валидирует форму ответа и превращает и
  транспортные, и validation-ошибки в один и тот же `RateFetchError`.
- **`src/useExchangeRate.ts`**: React hook. Запускает Effect из data layer
  как `Fiber`, переводит результат в `RequestState`
  (`idle`/`loading`/`success`/`error`), прерывает Fiber в cleanup. `retry`
  перезапускает тот же эффект через `retryToken` в зависимостях.
- **`src/ui/`** (`CurrencySelect`, `AmountInput`): presentational-компоненты,
  без зависимости от `rateApi`/`effect`/`useExchangeRate`.
- **`src/CurrencyExchangeWidget.tsx`**: контейнер, который собирает UI +
  `useExchangeRate`, считает `amount × rate`, управляет валидацией кнопки
  «Обменять» (сумма > 0, разные валюты, свежий успешный курс).

## Race condition: `ignore`-флаг vs Effect Fiber interruption

Классическое React-решение: булевый флаг `ignore` в cleanup. Запрос
продолжает выполняться в фоне, но устаревший результат просто не пишется в
state.

Здесь вместо этого каждый запрос является управляемым `Fiber` (`Effect.runFork`),
который получает `Fiber.interruptFork` при следующем запуске эффекта или
размонтировании: устаревший Fiber физически не доходит до
`onSuccess`/`onFailure`. Оговорка: сам mock-`Promise` внутри
`Effect.tryPromise` не abort-able (обычный `setTimeout`), так что таймер
всё равно досчитывает. Interruption останавливает не сетевой запрос, а
обработку его результата.

Regression-тест: `keeps the result of the latest request...` в
`src/CurrencyExchangeWidget.test.tsx`. Если убрать `Fiber.interruptFork` из
cleanup в `useExchangeRate.ts`, тест начинает падать.

## Типы

- `Money`: branded `number` (`number & { readonly __brand: "Money" }`),
  требует явного `toMoney()`.
- `RequestState<TData, TError>`: discriminated union вместо булевых
  флагов (`isLoading`/`isError`/...).
- `RateFetchError`: discriminated union по `_tag`
  (`RateServiceUnavailable` / `RateInvalidResponse` / `UnknownError`),
  валиден и как обычный TS union, и как Effect error channel.

## Тесты (Vitest + Testing Library)

- `src/CurrencyExchangeWidget.test.tsx`: end-to-end, покрывает race condition,
  валидацию кнопки «Обменять», error + Retry.
- `src/data/exchangeRate.test.ts`: Effect Data Layer в изоляции: успех,
  transport-ошибка, validation-ошибка, Fiber interruption.

```
npm run test    # vitest run
npm run build   # tsc -b && vite build
```

## Что добавили бы при переносе в реальный проект

Retry с exponential backoff, кэш курсов (с TTL), реальный API-контракт с
кодами 400/422/503, i18n сумм и форматирования чисел.
