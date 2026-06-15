#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import cloudscraper
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
VERIFICATION_JSON = ROOT / "data" / "hltv-verification-2026-06-08.json"
OUT_JSON = ROOT / "data" / "hltv-player-splits-2026-06-08.json"
OUT_MD = ROOT / "data" / "hltv-player-splits-2026-06-08.md"

START_DATE = "2026-01-01"
END_DATE = "2026-06-08"
FILTERS = {
    "overall": None,
    "top5": "Top5",
    "top10": "Top10",
    "top20": "Top20",
    "top50": "Top50",
}

SCRAPER_CONFIGS = [
    {
        "name": "native-chrome-mac",
        "kwargs": {
            "interpreter": "native",
            "browser": {"browser": "chrome", "platform": "darwin", "desktop": True, "mobile": False},
        },
    },
    {
        "name": "nodejs-chrome-mac",
        "kwargs": {
            "interpreter": "nodejs",
            "browser": {"browser": "chrome", "platform": "darwin", "desktop": True, "mobile": False},
        },
    },
    {
        "name": "native-firefox-linux",
        "kwargs": {
            "interpreter": "native",
            "browser": {"browser": "firefox", "platform": "linux", "desktop": True, "mobile": False},
        },
    },
    {
        "name": "native-chrome-mobile",
        "kwargs": {
            "interpreter": "native",
            "browser": {"browser": "chrome", "platform": "android", "desktop": False, "mobile": True},
        },
    },
    {
        "name": "native-chrome-mac-no-brotli-delay",
        "kwargs": {
            "interpreter": "native",
            "allow_brotli": False,
            "delay": 8,
            "browser": {"browser": "chrome", "platform": "darwin", "desktop": True, "mobile": False},
        },
    },
]


@dataclass
class PlayerRef:
    team: str
    rank: int
    handle: str
    player_id: int
    slug: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Try scraping HLTV 2026 player ranking-filter splits with cloudscraper.")
    parser.add_argument("--force", action="store_true", help="Try every player/filter even when the probe is blocked.")
    parser.add_argument("--limit", type=int, default=None, help="Limit player count for debugging.")
    parser.add_argument("--sleep", type=float, default=1.25, help="Delay between successful scrape requests.")
    args = parser.parse_args()

    players, missing_player_ids = read_player_refs()
    players = players[: args.limit]
    attempts: list[dict[str, Any]] = []
    scraper = None
    selected_config = None

    probe_player = next((player for player in players if player.handle.lower() == "zywoo"), players[0])
    probe_url = build_stats_url(probe_player, "top20")

    for config in SCRAPER_CONFIGS:
        candidate = cloudscraper.create_scraper(**config["kwargs"])
        attempt = fetch_page(candidate, probe_url)
        attempts.append(
            {
                "config": config["name"],
                "status": attempt["status"],
                "title": attempt.get("title"),
                "blocked": attempt["blocked"],
                "cloudflareManagedChallenge": attempt["cloudflare_managed"],
                "url": probe_url,
                "userAgent": candidate.headers.get("User-Agent"),
                "error": attempt.get("error"),
            }
        )
        if attempt["ok"] and parse_stats(attempt["text"]):
            scraper = candidate
            selected_config = config["name"]
            break

    blocked = scraper is None
    split_results: list[dict[str, Any]] = []

    if not blocked or args.force:
        if scraper is None:
            scraper = cloudscraper.create_scraper(**SCRAPER_CONFIGS[0]["kwargs"])
            selected_config = f"{SCRAPER_CONFIGS[0]['name']} (forced after blocked probe)"

        for player in players:
            player_result: dict[str, Any] = {
                "team": player.team,
                "rank": player.rank,
                "handle": player.handle,
                "playerId": player.player_id,
                "slug": player.slug,
                "splits": {},
            }
            for split_key in FILTERS:
                url = build_stats_url(player, split_key)
                response = fetch_page(scraper, url)
                stats = parse_stats(response["text"]) if response["ok"] else None
                player_result["splits"][split_key] = {
                    "url": url,
                    "status": response["status"],
                    "blocked": response["blocked"],
                    "cloudflareManagedChallenge": response["cloudflare_managed"],
                    "rating": stats.get("rating") if stats else None,
                    "maps": stats.get("maps") if stats else None,
                    "kdRatio": stats.get("kdRatio") if stats else None,
                    "adr": stats.get("adr") if stats else None,
                    "error": response.get("error"),
                }
                time.sleep(args.sleep)
            split_results.append(player_result)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "rankingDate": END_DATE,
        "dateWindow": {"startDate": START_DATE, "endDate": END_DATE},
        "source": "https://www.hltv.org/stats/players",
        "method": "cloudscraper",
        "cloudscraperVersion": getattr(cloudscraper, "__version__", "unknown"),
        "playersRequested": len(players),
        "missingPlayerIds": missing_player_ids,
        "missingPlayerIdCount": len(missing_player_ids),
        "filters": list(FILTERS.keys()),
        "probePlayer": {"handle": probe_player.handle, "playerId": probe_player.player_id, "url": probe_url},
        "probeAttempts": attempts,
        "selectedConfig": selected_config,
        "blockedByCloudflare": blocked,
        "notes": build_notes(blocked, args.force),
        "players": split_results,
    }

    OUT_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    OUT_MD.write_text(render_markdown(report), encoding="utf-8")

    print(f"Wrote {OUT_JSON.relative_to(ROOT)}")
    print(f"Wrote {OUT_MD.relative_to(ROOT)}")
    if blocked:
        print("HLTV stats pages were blocked by Cloudflare managed challenge; no player splits were scraped.")
    else:
        success_count = sum(
            1
            for player in split_results
            for split in player["splits"].values()
            if split["rating"] is not None and split["maps"] is not None
        )
        print(f"Scraped {success_count} player/filter splits with {selected_config}.")
    return 0


def read_player_refs() -> tuple[list[PlayerRef], list[dict[str, Any]]]:
    if not VERIFICATION_JSON.exists():
        raise FileNotFoundError(f"Run npm run verify:hltv first; missing {VERIFICATION_JSON}")

    verification = json.loads(VERIFICATION_JSON.read_text(encoding="utf-8"))
    players: list[PlayerRef] = []
    missing_player_ids: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()

    for team in verification.get("comparisons", []):
        detail_by_handle = {
            normalize_handle(player.get("handle", "")): player for player in team.get("remoteTeamPagePlayerDetails", []) if player.get("handle")
        }
        expected_handles = team.get("localPlayers") or [
            handle for handle in team.get("remoteRankingPlayers", []) if handle not in {"+1", "-1"}
        ]
        for handle in expected_handles:
            detail = detail_by_handle.get(normalize_handle(handle))
            if not detail or not detail.get("id"):
                missing_player_ids.append({"team": team.get("name", "Unknown"), "rank": team.get("rank", 0), "handle": handle})

        for player in team.get("remoteTeamPagePlayerDetails", []):
            player_id = player.get("id")
            handle = player.get("handle")
            if not player_id or not handle:
                continue
            key = (int(player_id), normalize_handle(handle))
            if key in seen:
                continue
            seen.add(key)
            players.append(
                PlayerRef(
                    team=team.get("name", "Unknown"),
                    rank=int(team.get("rank", 0)),
                    handle=handle,
                    player_id=int(player_id),
                    slug=player.get("slug") or slugify(handle),
                )
            )

    if not players:
        raise ValueError("No player IDs found in verification report. Re-run npm run verify:hltv after the latest script update.")

    return players, missing_player_ids


def build_stats_url(player: PlayerRef, split_key: str) -> str:
    query = {"startDate": START_DATE, "endDate": END_DATE}
    ranking_filter = FILTERS[split_key]
    if ranking_filter:
        query["rankingFilter"] = ranking_filter
    return f"https://www.hltv.org/stats/players/{player.player_id}/{player.slug}?{urlencode(query)}"


def fetch_page(scraper: cloudscraper.CloudScraper, url: str) -> dict[str, Any]:
    try:
        response = scraper.get(url, timeout=40)
        text = response.text or ""
        soup = BeautifulSoup(text, "lxml")
        title = soup.title.get_text(" ", strip=True) if soup.title else None
        blocked = is_cloudflare_block(text, response.status_code)
        return {
            "ok": response.status_code == 200 and not blocked,
            "status": response.status_code,
            "title": title,
            "text": text,
            "blocked": blocked,
            "cloudflare_managed": "challenges.cloudflare.com" in text or "/managed/" in text,
        }
    except Exception as error:  # noqa: BLE001 - report scraper failures without hiding them.
        return {
            "ok": False,
            "status": None,
            "text": "",
            "blocked": False,
            "cloudflare_managed": False,
            "error": f"{type(error).__name__}: {error}",
        }


def is_cloudflare_block(text: str, status: int | None) -> bool:
    lowered = text.lower()
    return bool(
        status in {403, 503}
        and (
            "just a moment" in lowered
            or "performing security verification" in lowered
            or "challenges.cloudflare.com" in lowered
            or "cloudflare" in lowered
        )
    )


def parse_stats(html: str) -> dict[str, float | int | None]:
    soup = BeautifulSoup(html, "lxml")
    stats: dict[str, float | int | None] = {}
    for row in soup.select(".stats-row"):
        parts = [part.get_text(" ", strip=True) for part in row.find_all("span")]
        if len(parts) < 2:
            continue
        label = parts[0].lower()
        value = parse_number(parts[-1])
        if "maps played" in label:
            stats["maps"] = int(value) if value is not None else None
        elif "rating" in label:
            stats["rating"] = value
        elif "k/d ratio" in label:
            stats["kdRatio"] = value
        elif "damage / round" in label:
            stats["adr"] = value
    return stats


def parse_number(value: str) -> float | None:
    cleaned = re.sub(r"[^0-9.+-]", "", value)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def build_notes(blocked: bool, forced: bool) -> list[str]:
    notes = [
        f"Date window is {START_DATE} through {END_DATE} to match the existing June 8, 2026 top-20 ranking audit.",
        "The script tries multiple cloudscraper browser/interpreter configurations before scraping the full player set.",
    ]
    if blocked:
        notes.append(
            "All probe attempts returned HLTV's Cloudflare managed challenge, so no split ratings were written back into src/hltvTop20.ts."
        )
    if forced:
        notes.append("--force was used, so full scrape attempts were made even though the initial probe was blocked.")
    return notes


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# HLTV Player Split Scrape - 2026-06-08",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "## Summary",
        "",
        f"- Method: {report['method']} {report['cloudscraperVersion']}",
        f"- Date window: {report['dateWindow']['startDate']} to {report['dateWindow']['endDate']}",
        f"- Players requested: {report['playersRequested']}",
        f"- Missing player IDs from rendered team pages: {report['missingPlayerIdCount']}",
        f"- Filters: {', '.join(report['filters'])}",
        f"- Blocked by Cloudflare: {'yes' if report['blockedByCloudflare'] else 'no'}",
        f"- Selected config: {report['selectedConfig'] or 'none'}",
        "",
        "## Probe Attempts",
        "",
        "| Config | Status | Managed challenge | Title |",
        "| --- | ---: | --- | --- |",
    ]

    for attempt in report["probeAttempts"]:
        lines.append(
            f"| {attempt['config']} | {attempt['status'] or '-'} | {'yes' if attempt['cloudflareManagedChallenge'] else 'no'} | {attempt.get('title') or '-'} |"
        )

    lines.extend(["", "## Notes", ""])
    lines.extend(f"- {note}" for note in report["notes"])

    if report["missingPlayerIds"]:
        lines.extend(["", "## Missing Player IDs", "", "| Team | Player |", "| --- | --- |"])
        for player in report["missingPlayerIds"]:
            lines.append(f"| {player['team']} | {player['handle']} |")

    if report["players"]:
        lines.extend(["", "## Scraped Splits", "", "| Team | Player | Overall | Top5 | Top10 | Top20 | Top50 |", "| --- | --- | --- | --- | --- | --- | --- |"])
        for player in report["players"]:
            cells = []
            for split_key in FILTERS:
                split = player["splits"].get(split_key, {})
                rating = split.get("rating")
                maps = split.get("maps")
                cells.append(f"{rating:.2f} ({maps})" if isinstance(rating, (int, float)) and maps is not None else "-")
            lines.append(f"| {player['team']} | {player['handle']} | {' | '.join(cells)} |")

    return "\n".join(lines).strip() + "\n"


def normalize_handle(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "", value.lower())


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "player"


if __name__ == "__main__":
    sys.exit(main())
