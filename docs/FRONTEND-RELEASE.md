# VORTEX Pulse frontend verification

Verified locally on 29 September 2026. No deployment or funded transaction was performed.

## Delivered

- VORTEX-branded Pulse market terminal, responsive token pages, chart controls, navigation, loading, empty and recovery states.
- Independent Jupiter price polling (15 seconds for Basic, 5 seconds for Elite), with a slower GeckoTerminal fallback. Fetch age and stale/error states are visible; polling is not presented as a guaranteed tick-by-tick stream.
- Horizontal 30-minute trending strip calculated from 30 completed one-minute candles. It ranks up to six unique tokens from a provider discovery shortlist by sampled pool volume, not the entire Solana market. The provider batch is cached for 120 seconds and the window allows one minute for provider availability. Incomplete windows are omitted.
- Keyless Jupiter quote/swap proxy routing, with optional server API key support. Keyless price and quote requests succeeded during verification; upstream access and rate limits remain provider-controlled.
- Existing 0.0075 SOL flat swap fee retained and disclosed before signing, with the existing Elite waiver. The fee is appended atomically to the unsigned swap transaction. Network fees and optional Turbo tip are separate and disclosed.
- Historical candles retain their original close values; tiny prices and numeric-string candles are preserved. Confirmed trade events no longer lose their event discriminator.

## Verification

- `pnpm build`: passed, including TypeScript and lint checks. Existing lint warnings remain.
- `pnpm exec tsc --noEmit`: passed.
- Node regression suite: 18 tests passed, covering existing payment checks, complete 30-minute windows, candle normalization, unsigned fee construction, payer validation, Elite waiver and optional tip.
- Production-preview Playwright checks: market widths 1440, 1280, 768 and 375; token widths 1440, 768 and 375; mobile swap form at 375. Eight accessibility scans reported zero violations for the selected WCAG A/AA tags; zero page errors. Market/token views had no document-level horizontal overflow.
- Interaction checks passed for search/clear, sort direction, density, methodology disclosure, empty/error/retry states, wallet and project dialogs, chart timeframe selection and quote-error rendering. Home overflow checked at 1280 and 375.
- Browser checks use isolated fixtures. Screenshots are sample-data previews, not evidence of market prices.
- Separate production API smoke checks used real providers: discovery HTTP 200 (20 tokens), trending HTTP 200 (4 complete candidates), Jupiter price HTTP 200, and SOL-to-USDC quote HTTP 200 with an output amount.

## Remaining launch validation

A real wallet's signing/approval experience, funded swap confirmation, fee receipt, and Turbo relay delivery have not been exercised end to end. These require an explicitly authorized funded transaction. Automated transaction-construction tests and read-only quotes do not replace that check. Deployment environment, provider capacity under load, and full product security are outside this frontend verification.

Local verification artifacts are in ignored `tmp/pulse-qa/`; build output is in `tmp/pulse-final-build.log`. The production preview runs on `http://127.0.0.1:3100` while its process remains active.
