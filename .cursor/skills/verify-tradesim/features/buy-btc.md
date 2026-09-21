# Buy BTC

Buy BTC spends cash from the signed-in wallet at the live Bitcoin price and records the trade.

## Sub-features

- `buy-open` shows the buy form on the dashboard.
- `buy-review` shows spend, receive, and the live price before the trade is sent.
- `buy-submit` spends USDT and adds BTC only after `Confirm buy`.
- `buy-percent` fills the pay field from the available cash.
- `buy-history` shows the new trade on the profile.

## How to get to it (user POV)

- Sign in and land on `/dashboard`.
- Choose `Dashboard` in the header.
- Choose the `TradeSim` wordmark, which also goes to `/dashboard`.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The wallet command shows `usdtBalance` `10000` and `btcBalance` `0`.
- The dashboard heading is `Welcome Back, Verify User!`, not `Could Not Load Dashboard`.
- The `Buy` tab is selected. The primary button reads `Review buy`.

- **Enter an amount.** Type `100` into the textbox named `You Pay`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "You Pay" --value "100"`. The read-only `You Receive` value becomes a positive BTC amount, and the field still shows the `USDT` suffix.
- **Review the buy.** Choose `Review buy`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Review buy"`, then wait for `Confirm buy`. The card shows `Buy BTC`, `Spend`, `Receive`, `Price`, and `Live`. The wallet is unchanged.
- **Submit the buy.** Choose `Confirm buy`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Confirm buy"`, then wait for `Bought`. The pay field clears and the primary button reads `Review buy` again.
- **Confirm balances.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173`. Cash is below `10000`, BTC is above `0`, and `trades` is `1`.
- **Open history.** Choose `Profile` in the header, or choose the `Total Trades` card. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Profile"`. The `Trade History` table contains a `BUY` row, and `Total Trades` on the profile is `1`.
- **Proof.** On the profile history, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/buy-btc/history.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/buy-btc/history.png`. Save the wallet stdout to `.cursor/skills/verify-tradesim/artifacts/buy-btc/wallet.txt`.

## Gotchas

- The pay field's accessible name is `You Pay`. `Review buy` does not create a trade. The wallet stays at the pre-trade balances until `Confirm buy`.
- `Edit` leaves the review and keeps the amount. That path is covered by the order-review recipe.
- `25%`, `50%`, and `100%` replace the pay amount with a fraction of available USDT. `100%` on Sell uses the full BTC balance.
- The price comes from CoinGecko at submit time. Assert that cash went down and BTC went up, not a fixed BTC quantity.
- A success toast without a wallet row is not proof. The trade must exist in sqlite and in `Trade History`.
- Sell is a separate action. This recipe only proves a buy. Selling with an empty BTC balance shows an insufficient-balance error.
