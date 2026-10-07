# Chart dates

The dashboard Bitcoin price card can be limited to a start date and an end date. The graph and the change summary redraw for that window.

## Sub-features

- `chart-dates-open` shows `From` and `To` on the Bitcoin Price card, with the description beginning `Showing last 30 days`.
- `chart-dates-apply` loads the chosen window and sets the description prefix to `Filtered to Sep 24, 2026 – Oct 1, 2026`.
- `chart-dates-clear` removes the filter and returns the description to `Showing last 30 days`.
- `chart-dates-order` rejects an end date before the start date with `The start date must be on or before the end date.`

## How to get to it (user POV)

- Sign in and land on `/dashboard`.
- Choose `Dashboard` in the header.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The dashboard heading is `Welcome Back, Verify User!`.
- `tradesim-verify.sh fault live --port 4173` has been run. The Bitcoin Price card is visible. CoinGecko has to answer for the filtered series; if the card says `Chart unavailable`, stop and do not claim `chart-dates-apply`.

- **Open the chart.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Showing last 30 days"`. The card title is `Bitcoin Price`. Textboxes `From` and `To` are empty. `Clear dates` is absent.
- **Apply a window.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "From" --value "2026-09-24"` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "To" --value "2026-10-01"`. Wait with `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Filtered to Sep 24, 2026 – Oct 1, 2026"`. The button `Clear dates` is present. The description still includes `Increased by` or `Decreased by`.
- **Proof of the filtered chart.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/chart-dates/filtered.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/chart-dates/filtered.png`. The snapshot includes `Filtered to Sep 24, 2026 – Oct 1, 2026`, textbox `From`, and textbox `To`.
- **Clear the window.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Clear dates"`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Showing last 30 days"`. The filtered sentence is gone.
- **Reject an inverted window.** Fill `From` with `2026-10-01` and `To` with `2026-09-24`. Wait for `The start date must be on or before the end date.` Leave the dates cleared before the next recipe: click `Clear dates` and wait for `Showing last 30 days`.

## Gotchas

- `From` and `To` are the accessible names. The visible labels match them. Fill the value as `YYYY-MM-DD`.
- One filled date does not filter. The hint is `Choose both dates to filter the chart.` and the preset series stays up.
- These sample dates stay inside a 365-day span only while today is on or after `2026-10-01` and the span from `2026-09-24` to today is still 365 days or less. After that, pick a newer pair inside the last year and expect the matching `Filtered to` sentence.
- A future end date is clamped to today. The description uses the clamped day, not the typed day.
- Choosing `Last 7 Days`, `Last 30 Days`, `Last 3 Months`, or `Last Year` clears `From` and `To`. The preset control's accessible name stays `Select a value`.
- Axis labels use UTC days, same as the filter. Do not assert a timezone-shifted day.
- Proof files under `artifacts/chart-dates/` are local. Do not commit them.
