
# JollyCurve_'s Unified Semi-Anarchy Scammer List

A web page that aggregates scammer lists from multiple Minecraft semi-anarchy trading Discords into a single, searchable, UUID-based list. Because scammers change their usernames, the list tracks them by UUID rather than name, and resolves their current username live on page load.

## Servers covered

-   [Uneasy Vanilla](https://discord.gg/XrvxpVv9KU)
-   [Simply Vanilla](https://discord.gg/g5YJ2f69sZ)
-   [Anarchy Network](https://discord.gg/SeawAYDTGy)
-   [Purity Vanilla](https://discord.gg/KrkxKmG24)
-   [Refined Vanilla](https://discord.gg/m5fGuqHyeb)

## Features

-   Live username and username history resolution via the [Crafty API](https://crafty.gg)
-   Live Discord account resolution via [JAPI](https://japi.rest)
-   Tracks alts linked to main accounts
-   Unified search across usernames, UUID, username history, alts, and Discord accounts
-   Shareable search links via URL query parameter
-   Stats tab with charts on account and server distribution
-   Archives tab with downloadable server-specific scammer list ZIPs
-   Client-side caching to reduce repeat API load

## File overview

File

Purpose

`index.html`

Page structure and tab layout

`style.css`

Styles

`api.js`

Data fetching, caching, and server registry

`ui.js`

Card rendering and archive tab

`graphs.js`

Stats tab charts

`app.js`

Bootstrap pipeline, search, and lifecycle

`data.json`

Scammer UUIDs, alt maps, Discord links, and server tags

`discord.json`

Fallback Discord user data

`EXTRASOURCES.md`

Supplementary sources for various data points that don't fit anywhere else

## Data

All scammer data is maintained manually in `data.json`. UUIDs were determined manually. See the FAQ on the page for methodology details.
