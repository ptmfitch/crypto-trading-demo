# Recurring buy

Recurring buy schedules a USDT market buy of an allowlisted asset. Creating a plan does not trade. The next dashboard or profile load, or a poll while the profile stays open, fills a due Bitcoin plan or skips the period when USDT is short.

## Sub-features

- `recurring-create` starts a weekly $50 BTC plan from the profile sheet.
- `recurring-list` shows that plan as Active with a next run.
- `recurring-fill` buys BTC when a due plan loads, or skips the period when cash is short.
- `recurring-pause` pauses and resumes the same plan.
- `recurring-cancel` cancels after an inline confirm and removes the row.

## How to get to it (user POV)

- Sign in and choose `Profile`.
- Open `/profile` directly.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The wallet command shows `usdtBalance` `10000` and `btcBalance` `0`.
- The profile heading is `Performance Report`.
- The quote is live. If the dashboard trade card shows `Price delayed` or `Price unavailable`, run `tradesim-verify.sh fault live --port 4173` and reload before the fill step.

- **Open the sheet.** On `/profile`, choose `Create a plan`. The dialog heading is `New recurring buy`. The asset combobox is `Asset`, the amount textbox is `Amount (USDT)`, and the cadence buttons are `Daily` and `Weekly`.
- **Start the plan.** Leave BTC, `$50`, and `Weekly` selected, then choose `Start plan`. Wait for `Weekly $50 BTC plan active`. The row reads `BTC · $50 · Weekly` and `Active`. Trade history does not gain a row from this step.
- **Make it due.** Set `nextRunAt` in this run's sqlite file to `2000-01-01 00:00:00`, then reload `/profile`. Wait for `Recurring buy filled · $50 BTC`. `tradesim-verify.sh wallet verify-user@example.com --port 4173` shows cash below `10000`, BTC above `0`, and `trades` `1`.
- **Pause and resume.** Choose `Pause`. The pill reads `Paused` and the button reads `Resume`. Choose `Resume`. The pill reads `Active` again.
- **Cancel.** Choose `Cancel`, then `Confirm cancel`. The row is gone and the empty line offers `Create a plan`.
- **Proof.** After the fill, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/recurring-buy/filled.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/recurring-buy/filled.png`. Save the wallet stdout beside them.

## Gotchas

- The first run is one cadence after create. A weekly plan does not buy until `nextRunAt` is due.
- ETH and SOL plans can be saved. The paper wallet has no balance for them, so a due period advances with no trade.
- A short USDT balance skips the period, advances `nextRunAt`, and does not toast.
- A stale BTC quote leaves the period due and does not buy.
- `Cancel` asks for `Confirm cancel` in the row. That is the cancel.
