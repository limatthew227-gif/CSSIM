# HLTV Player Split Scrape - 2026-06-08

Generated: 2026-06-15T05:59:01.583900+00:00

## Summary

- Method: cloudscraper 1.2.71
- Date window: 2026-01-01 to 2026-06-08
- Players requested: 73
- Missing player IDs from rendered team pages: 27
- Filters: overall, top5, top10, top20, top50
- Blocked by Cloudflare: yes
- Selected config: none

## Probe Attempts

| Config | Status | Managed challenge | Title |
| --- | ---: | --- | --- |
| native-chrome-mac | 403 | yes | Just a moment... |
| nodejs-chrome-mac | 403 | yes | Just a moment... |
| native-firefox-linux | 403 | yes | Just a moment... |
| native-chrome-mobile | 403 | yes | Just a moment... |
| native-chrome-mac-no-brotli-delay | 403 | yes | Just a moment... |

## Notes

- Date window is 2026-01-01 through 2026-06-08 to match the existing June 8, 2026 top-20 ranking audit.
- The script tries multiple cloudscraper browser/interpreter configurations before scraping the full player set.
- All probe attempts returned HLTV's Cloudflare managed challenge, so no split ratings were written back into src/hltvTop20.ts.

## Missing Player IDs

| Team | Player |
| --- | --- |
| FURIA | FalleN |
| FURIA | yuurih |
| FURIA | YEKINDAR |
| FURIA | KSCERATO |
| FURIA | molodoy |
| MOUZ | Brollan |
| GamerLegion | Snax |
| GamerLegion | REZ |
| GamerLegion | Tauson |
| GamerLegion | PR |
| GamerLegion | hypex |
| Astralis | HooXi |
| Astralis | phzy |
| Astralis | jabbi |
| Astralis | Staehr |
| Astralis | ryu |
| FaZe | Neityu |
| paiN | vsm |
| paiN | biguzera |
| paiN | piriajr |
| paiN | saffee |
| paiN | snow |
| MIBR | LNZ |
| MIBR | brnz4n |
| MIBR | insani |
| MIBR | venomzera |
| MIBR | kl1m |
