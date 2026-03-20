# Wine List

A Progressive Web App (PWA) for displaying a searchable wine list on tablets. Pulls data from a Google Sheet and auto-refreshes every 3 minutes. Includes an inactivity reset overlay for unattended kiosk use.


## Url
https://irongatewinelist.github.io/winelist/

## Configuration

Edit the constants at the top of `app.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SHEET_CSV_URL` | — | Google Sheets CSV publish URL |
| `REFRESH_INTERVAL` | 3 minutes | How often to pull fresh data |
| `INACTIVITY_TIMEOUT` | 8 minutes | Idle time before showing the reset overlay |
| `CACHE_MAX_AGE` | 18 hours | How old cached data can be before showing a stale warning |
| `CURRENCY` | `$` | Currency symbol shown before prices |

## Features

- **Multi-term search** — "pinot 2019" finds pinot noirs from 2019
- **Section navigation** — right-side nav for jumping between categories
- **Auto-refresh** — pulls updated data from Google Sheets on an interval
- **Offline support** — caches data locally, works without WiFi
- **Stale data warning** — shows a banner if cached data is older than 18 hours
- **Inactivity reset** — returns to the top with a "Touch to browse" overlay after idle timeout
- **PWA installable** — can be added to the home screen for a full-screen app experience
