# Recurring buy

A signed-in user keeps one recurring buy: a dollar amount and a daily or weekly cadence. Opening the dashboard fills that buy at the live quote when it is due. A delayed quote skips the fill and leaves the next buy due.

## Sub-features

- `recurring-save` stores one dollar amount and a daily or weekly cadence and shows `Next buy` on the trade card.
- `recurring-skip` leaves the wallet unchanged when the buy is due and the quote is delayed.
- `recurring-fill` spends USDT and adds BTC when the dashboard opens on a live quote and the buy is due.
- `recurring-next` shows the following `Next buy` time after the fill.

## How to get to it (user POV)

- Sign in and land on `/dashboard`.
- Choose `Dashboard` in the header.
- Choose the `TradeSim` wordmark, which also goes to `/dashboard`.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The wallet command shows `usdtBalance` `10000` and `btcBalance` `0`.
- The dashboard heading is `Welcome Back, Verify User!`, not `Could Not Load Dashboard`.
- `tradesim-verify.sh fault live --port 4173` has been run, and a dashboard load has written a real quote. `tradesim-verify.sh quote --port 4173` prints JSON with a positive `usd`. Do not hand-write that file.
- Then run `tradesim-verify.sh fault fail --port 4173`, `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard`, and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Price delayed"`. The trade card shows `Next buy: none`.

- **Enter the plan.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "Recurring amount" --value "100"`. Choose `Weekly`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Weekly"`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Save recurring buy"`. Wait for `Next buy: $100.00 weekly · due now` and `Recurring buy skipped until a live quote returns.`
- **Switch the cadence.** Choose `Daily` and save again. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Daily"`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Save recurring buy"`. Wait for `Next buy: $100.00 daily · due now`. The skip line is still visible.
- **Confirm the skip.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173`. Cash is still `10000`, BTC is still `0`, and `trades` is `0`. The recurring row shows cadence `daily` and `usdtAmount` `100`.
- **Proof of the skip.** On that delayed dashboard, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/recurring-buy/skipped.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/recurring-buy/skipped.png`. Save the wallet stdout to `.cursor/skills/verify-tradesim/artifacts/recurring-buy/skipped-wallet.txt`. The snapshot includes `due now`, `Recurring buy skipped until a live quote returns.`, and `button "BUY BTC" disabled`.
- **Open the dashboard on a live quote.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh fault live --port 4173`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard`. Wait for `Recurring buy filled.` The `Next buy` line still starts with `Next buy: $100.00 daily` and does not say `due now`. `Price delayed` is gone and `BUY BTC` is enabled.
- **Confirm the fill.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173`. Cash is below `10000`, BTC is above `0`, and `trades` is `1`.
- **Open history.** Choose `Profile`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Profile"`. The `Trade History` table contains a `BUY` row, and `Total Trades` on the profile is `1`.
- **Proof of the fill.** On the profile history, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/recurring-buy/history.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/recurring-buy/history.png`. Save the wallet stdout to `.cursor/skills/verify-tradesim/artifacts/recurring-buy/filled-wallet.txt`.

## Gotchas

- The recurring amount's accessible name is `Recurring amount`. The manual pay field is still the number input named `0.00`.
- `Daily` and `Weekly` are toggle buttons. `Save recurring buy` is a separate submit button from `BUY BTC`.
- Saving a new plan makes the first buy due immediately. The dashboard render after the save is what fills it. While `Price delayed` is showing, that render skips.
- A skipped buy stays due. Restoring the feed does nothing until the next dashboard load.
- One dashboard load fills one due buy. The following `Next buy` is one day or one week after that fill. Missed intervals are not replayed.
- A success toast or `Recurring buy filled.` without a wallet row and a `BUY` in `Trade History` is not proof.
- Do not hand-write `btc-price.json`. Use `fault live` and a real dashboard load before `fault fail`.
