# Order review

Order review shows the side, spend, receive, and live price on the trade card, and sends the order only after Confirm buy or Confirm sell. Edit returns to the amount and keeps what was typed.

## Sub-features

- `review-buy` opens the buy summary from an amount.
- `review-edit` returns to the amount without clearing it and without a trade.
- `review-confirm` sends the buy from Confirm buy.
- `review-sell` opens the sell summary and sends it from Confirm sell.

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

- **Enter an amount.** Type `100` into `You Pay`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "You Pay" --value "100"`. The button reads `Review buy`.
- **Open the review.** Choose `Review buy`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Review buy"`, then wait for `Confirm buy`. The card shows `Buy BTC`, `Spend`, `$100.00`, `Receive`, `Price`, and `Live`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/order-review/buy-review.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/order-review/buy-review.png`.
- **Edit without trading.** Choose `Edit`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Edit"`, then wait for `Review buy`. The `You Pay` value is still `100`. The wallet command still shows `usdtBalance` `10000`, `btcBalance` `0`, and `trades` `0`.
- **Confirm the buy.** Choose `Review buy`, then `Confirm buy`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Review buy"` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Confirm buy"`, then wait for `Bought`. Cash is below `10000`, BTC is above `0`, and `trades` is `1`.
- **Review a sell.** Choose the `Sell` tab. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role tab --name "Sell"`. Choose `25%`, then `Review sell`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "25%"` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Review sell"`, then wait for `Confirm sell`. The card shows `Sell BTC`, `Spend`, and `Receive`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/order-review/sell-review.png`.
- **Confirm the sell.** Choose `Confirm sell`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Confirm sell"`, then wait for `Sold`. `trades` is `2`.
- **Proof.** Save `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173` to `.cursor/skills/verify-tradesim/artifacts/order-review/wallet.txt`. Record feature id `order-review`, entry `/dashboard`, and the port beside the artifacts.

## Gotchas

- `Review buy` and `Review sell` do not call the trade. A toast or a wallet change before Confirm means the gate failed.
- `Edit` keeps the typed amount. Do not treat a return to `You Pay` as a cancelled order unless the wallet row is unchanged.
- Switching `Buy` and `Sell` leaves the review and keeps the number in the field. Confirm the tab before reading Spend.
- The live price can move the receive estimate while review is open. Spend stays on the amount captured when review opened.
- This recipe buys and then sells on the same wallet. Run it from a fresh `10000` / `0` wallet, not after the buy-btc recipe.
