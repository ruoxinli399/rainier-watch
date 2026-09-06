# Rainier Watch

A small local dashboard for Seattle-area photographers deciding whether Mount Rainier is worth heading out to shoot.

## Run locally

1. Install Node.js 22 or newer.
2. Run `npm install` in this folder.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

The dashboard refreshes automatically every five minutes. **Refresh now** updates both camera sources and the weather signal immediately.

## Source behavior verified on September 6, 2026

- **Tacoma:** The camera labeled “Tacoma › South-east: LeMay - America’s Car Museum - Tacoma Dome” is Windy webcam `1707679927`, surfaced on Meteoblue. Meteoblue exposes Windy’s official, tokenized public embed player. The token changes, so the local server retrieves a fresh embed URL instead of storing one. Windy’s normal webcam page cannot be framed by unrelated sites, but its dedicated `/public/embed/player/…` endpoint is intended for embedding. Windy requires its webcam images to be linked and credited; the dashboard keeps the player intact and shows attribution.
- **Seattle:** `ismtrainierout.com` publishes a same-day Space Needle Panocam frame about every ten minutes and exposes the latest frame in its Open Graph metadata. Its current page and image responses do not send an `X-Frame-Options` or restrictive `frame-ancestors` policy. The dashboard shows that current frame with a link and credits both Is Mt Rainier Out? and the Space Needle Panocam. No explicit reuse license was found, so ask the owner before public or commercial deployment.
- **Weather:** Current visibility, low/mid/high cloud cover, precipitation, and daylight status come from Open-Meteo. Attribution is included beside the adapted signal as required by its CC BY 4.0 data license.

## How the indicator works

The indicator is deliberately lightweight and weather-only; it does not run image recognition. It averages Seattle and Tacoma conditions, weighting low cloud most heavily, then modeled horizontal visibility, with penalties for precipitation. Scores of 68+ show **Rainier likely visible**, 38–67 show **Maybe**, and lower scores show **Rainier likely not visible**. At night the dashboard always asks the photographer to check again in daylight.

Treat it as a fast screening signal, not a guarantee. Rainier can sit behind a local cloud cap even when both cities are clear, and haze can hide the mountain at distances that ordinary weather visibility metrics do not fully capture.

## Fallbacks

If a source is offline, its markup changes, or a browser blocks third-party media, the panel switches to an explanation and a direct **Open source** link. The other camera and the weather signal continue to work independently.
