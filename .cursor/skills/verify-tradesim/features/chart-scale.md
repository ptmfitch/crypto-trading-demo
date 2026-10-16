# Chart scale

The Bitcoin Price chart draws the recent USD series on an axis labeled in thousands of dollars. `$110.4k` means about $110,400, and that band sits next to the Live BTC Price on the same dashboard.

## Sub-features

- `chart-scale` names the plot `Bitcoin price from $…k to $…k` and shows the same thousands on the Y-axis. The live quote falls in that band, not about ten times below it.
- `chart-range` keeps that labeling after the range changes from Last 30 Days to Last 7 Days.

## How to get to it (user POV)

- Sign in and land on `/dashboard`.
- Choose `Dashboard` in the header.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The dashboard heading is `Welcome Back, Verify User!`.
- CoinGecko has answered. `Live BTC Price` is a dollar amount, and the chart is not `Chart unavailable`. Do not hand-write the chart cache.

- **Open the dashboard.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Bitcoin Price"`. The stat `Live BTC Price` shows a positive dollar amount. The card description reports increased or decreased, not `Chart unavailable`.
- **Read the axis.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/chart-scale/dashboard.aria.txt`. The snapshot contains an image whose name matches `Bitcoin price from $` and `k to $`, ending in `k`. Read the two figures as thousands of dollars. `Live BTC Price` on that same snapshot is inside that band, or within a few percent of it. A figure about ten times the live quote (for example `$1104.0k` beside a ~$110,400 price) fails this check.
- **Change the range.** Choose the combobox `Select a value`, then `Last 7 Days`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role combobox --name "Select a value"` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role option --name "Last 7 Days"`. Wait until the image name still matches `Bitcoin price from $` and ends in `k`, and `Live BTC Price` still sits in that band.
- **Proof.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/chart-scale/axis.png` after the 7-day range is showing. The Y-axis labels are an even step in thousands (`$80k`, `$81k`, `$82k`), readable, and in the same band as `Live BTC Price`. Each calendar day on that range appears once. Save `tradesim-verify.sh quote --port 4173` to `.cursor/skills/verify-tradesim/artifacts/chart-scale/quote.txt`.

## Gotchas

- The axis used to divide by 100 and then append `k`, so a ~$110,400 price was labeled about `$1104.0k`. The image name repeats that bug when it is still present.
- `Live BTC Price` is the spot quote. The chart band is the selected history plus a little padding, so the spot can sit just outside either end. It cannot sit an order of magnitude away.
- The default range is Last 30 Days. The combobox accessible name is `Select a value`, not the visible range text.
- `Chart unavailable` means this recipe has no series yet. Do not treat that empty state as a passing scale check.
- Proof screenshots stay untracked. Do not commit `.cursor/skills/verify-tradesim/artifacts`.
