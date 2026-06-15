#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except Exception:
    pass

os.environ.setdefault("SETUPTOOLS_USE_DISTUTILS", "local")

from scrapy import Selector
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
import undetected_chromedriver as uc

ROOT = Path(__file__).resolve().parents[1]
VERIFICATION_JSON = ROOT / "data" / "hltv-verification-2026-06-08.json"
OUT_JSON = ROOT / "data" / "hltv-player-playoffs-uc-2026-06-08.json"
OUT_MD = ROOT / "data" / "hltv-player-playoffs-uc-2026-06-08.md"
OUT_TS = ROOT / "src" / "hltvPlayerPlayoffs2026.ts"

START_DATE = "2026-01-01"
END_DATE = "2026-06-08"
CHROME_BINARY = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FILTERS = {
    "overall": None,
    "top5": "Top5",
    "top10": "Top10",
    "top20": "Top20",
    "top50": "Top50",
}


@dataclass
class ExpectedPlayer:
    team: str
    rank: int
    handle: str
    player_id: int | None = None
    slug: str | None = None

    @property
    def key(self) -> str:
        return make_key(self.team, self.handle)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape HLTV player playoffs splits rankings.")
    parser.add_argument("--headless", action="store_true", help="Use headless Chrome.")
    parser.add_argument("--write-ts", action="store_true", help="Write src/hltvPlayerPlayoffs2026.ts.")
    parser.add_argument("--limit", type=int, default=None, help="Limit expected players for debugging.")
    parser.add_argument("--sleep", type=float, default=1.5, help="Delay between page requests.")
    args = parser.parse_args()

    expected_players = read_expected_players()
    if args.limit:
        expected_players = expected_players[: args.limit]

    expected_by_key = {player.key: player for player in expected_players}
    expected_by_id = {player.player_id: player for player in expected_players if player.player_id}

    driver = make_driver(headless=args.headless)
    scrape_errors: list[dict[str, Any]] = []
    filter_rows: dict[str, list[dict[str, Any]]] = {}
    try:
        for filter_key, ranking_filter in FILTERS.items():
            url = build_ranking_url(ranking_filter)
            page = load_page(driver, url)
            if page["blocked"] or not page["hasTable"]:
                scrape_errors.append(
                    {
                        "filter": filter_key,
                        "url": url,
                        "title": page["title"],
                        "blocked": page["blocked"],
                        "hasTable": page["hasTable"],
                    }
                )
                filter_rows[filter_key] = []
            else:
                filter_rows[filter_key] = parse_ranking_rows(page["html"], filter_key)
            time.sleep(args.sleep)
    finally:
        driver.quit()

    players = merge_expected_with_rows(expected_players, expected_by_key, expected_by_id, filter_rows)
    matched = [player for player in players if any(split.get("rating") is not None for split in player["splits"].values())]
    unmatched = [player for player in players if not any(split.get("rating") is not None for split in player["splits"].values())]
    missing_filters = [
        {
            "team": player["team"],
            "handle": player["handle"],
            "missing": [filter_key for filter_key, split in player["splits"].items() if split.get("rating") is None],
        }
        for player in players
        if any(split.get("rating") is None for split in player["splits"].values())
    ]

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "rankingDate": END_DATE,
        "dateWindow": {"startDate": START_DATE, "endDate": END_DATE},
        "method": "scrapy-selector + undetected-chromedriver (playoffs)",
        "headless": args.headless,
        "filters": list(FILTERS.keys()),
        "expectedPlayers": len(expected_players),
        "matchedPlayers": len(matched),
        "unmatchedPlayers": len(unmatched),
        "completePlayers": sum(1 for player in players if all(split.get("rating") is not None for split in player["splits"].values())),
        "scrapeErrors": scrape_errors,
        "notes": [
            "Scraped from HLTV stats rankings page with playoffMatchType=PLAYOFFS",
            "Values represent playoff performance stats.",
        ],
        "players": players,
        "missingFilters": missing_filters,
    }

    OUT_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    OUT_MD.write_text(render_markdown(report), encoding="utf-8")
    if args.write_ts:
        OUT_TS.write_text(render_typescript_samples(report), encoding="utf-8")

    print(f"Wrote {OUT_JSON.relative_to(ROOT)}")
    print(f"Wrote {OUT_MD.relative_to(ROOT)}")
    if args.write_ts:
        print(f"Wrote {OUT_TS.relative_to(ROOT)}")
    print(f"Matched {report['matchedPlayers']} of {report['expectedPlayers']} players; complete split sets: {report['completePlayers']}")
    if scrape_errors:
        print(f"Scrape errors: {len(scrape_errors)}")
    return 0 if report["matchedPlayers"] else 1


def make_driver(headless: bool):
    options = uc.ChromeOptions()
    options.binary_location = CHROME_BINARY
    options.add_argument("--window-size=1400,1000")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--lang=en-US,en")
    if headless:
        options.add_argument("--headless=new")
    return uc.Chrome(options=options, use_subprocess=True)


def load_page(driver, url: str) -> dict[str, Any]:
    try:
        driver.set_page_load_timeout(70)
        driver.get(url)
    except TimeoutException:
        pass

    html = ""
    for _ in range(20):
        time.sleep(1.5)
        html = driver.page_source
        if "player-ratings-table" in html or is_cloudflare_block(html):
            if "player-ratings-table" in html:
                break

    body = ""
    try:
        body = driver.find_element(By.TAG_NAME, "body").text
    except Exception:
        pass

    return {
        "url": url,
        "title": driver.title,
        "html": html,
        "body": body,
        "blocked": is_cloudflare_block(html),
        "hasTable": "player-ratings-table" in html,
    }


def is_cloudflare_block(html: str) -> bool:
    lowered = html.lower()
    return "performing security verification" in lowered or "challenges.cloudflare.com" in lowered or "/managed/" in html


def build_ranking_url(ranking_filter: str | None) -> str:
    query: dict[str, str] = {"startDate": START_DATE, "endDate": END_DATE, "minMapCount": "0", "playoffMatchType": "PLAYOFFS"}
    if ranking_filter:
        query["rankingFilter"] = ranking_filter
    return f"https://www.hltv.org/stats/players?{urlencode(query)}"


def parse_ranking_rows(html: str, filter_key: str) -> list[dict[str, Any]]:
    selector = Selector(text=html)
    rows = []
    for row in selector.css(".player-ratings-table tbody tr"):
        href = row.css(".playerCol a::attr(href)").get() or ""
        player_id_match = re.search(r"/stats/players/(\d+)/([^?]+)", href)
        stats_details = [parse_number(value) for value in row.css("td.statsDetail::text").getall()]
        rating = parse_number(row.css("td.ratingCol::text").get())
        rows.append(
            {
                "filter": filter_key,
                "playerId": int(player_id_match.group(1)) if player_id_match else None,
                "slug": player_id_match.group(2) if player_id_match else None,
                "handle": clean(row.css(".playerCol a::text").get()),
                "teams": [clean(value) for value in row.css(".teamCol img::attr(title)").getall()],
                "maps": int(stats_details[0]) if len(stats_details) > 0 and stats_details[0] is not None else None,
                "rounds": int(stats_details[1]) if len(stats_details) > 1 and stats_details[1] is not None else None,
                "kd": stats_details[2] if len(stats_details) > 2 else None,
                "kdDiff": parse_number(row.css("td.kdDiffCol::text").get()),
                "rating": rating,
            }
        )
    return rows


def merge_expected_with_rows(
    expected_players: list[ExpectedPlayer],
    expected_by_key: dict[str, ExpectedPlayer],
    expected_by_id: dict[int, ExpectedPlayer],
    filter_rows: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    merged = {
        player.key: {
            "team": player.team,
            "rank": player.rank,
            "handle": player.handle,
            "playerId": player.player_id,
            "slug": player.slug,
            "splits": {filter_key: empty_split() for filter_key in FILTERS},
        }
        for player in expected_players
    }

    for filter_key, rows in filter_rows.items():
        for row in rows:
            expected = None
            player_id = row.get("playerId")
            if player_id in expected_by_id:
                expected = expected_by_id[player_id]
            else:
                matching_keys = [make_key(team, row["handle"]) for team in row["teams"]]
                expected = next((expected_by_key[key] for key in matching_keys if key in expected_by_key), None)
            if not expected:
                continue

            entry = merged[expected.key]
            entry["playerId"] = entry.get("playerId") or row.get("playerId")
            entry["slug"] = entry.get("slug") or row.get("slug")
            entry["splits"][filter_key] = {
                "rating": row.get("rating"),
                "maps": row.get("maps"),
                "rounds": row.get("rounds"),
                "kd": row.get("kd"),
                "kdDiff": row.get("kdDiff"),
            }

    return list(merged.values())


def empty_split() -> dict[str, Any]:
    return {"rating": None, "maps": None, "rounds": None, "kd": None, "kdDiff": None}


def read_expected_players() -> list[ExpectedPlayer]:
    verification = json.loads(VERIFICATION_JSON.read_text(encoding="utf-8"))
    expected: list[ExpectedPlayer] = []
    seen: set[str] = set()
    for team in verification.get("comparisons", []):
        detail_by_handle = {
            normalize_handle(player.get("handle", "")): player for player in team.get("remoteTeamPagePlayerDetails", []) if player.get("handle")
        }
        for handle in team.get("localPlayers", []):
            key = make_key(team["name"], handle)
            if key in seen:
                continue
            seen.add(key)
            detail = detail_by_handle.get(normalize_handle(handle), {})
            expected.append(
                ExpectedPlayer(
                    team=team["name"],
                    rank=int(team["rank"]),
                    handle=handle,
                    player_id=detail.get("id"),
                    slug=detail.get("slug"),
                )
            )
    return expected


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# HLTV Player Playoffs Splits Scrape - 2026-06-08",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "## Summary",
        "",
        f"- Method: {report['method']}",
        f"- Date window: {report['dateWindow']['startDate']} to {report['dateWindow']['endDate']}",
        f"- Expected players: {report['expectedPlayers']}",
        f"- Matched players: {report['matchedPlayers']}",
        f"- Complete split sets: {report['completePlayers']}",
        f"- Headless: {'yes' if report['headless'] else 'no'}",
        "",
        "## Notes",
        "",
        *[f"- {note}" for note in report["notes"]],
        "",
        "## Missing Or Partial",
        "",
        "| Team | Player | Missing filters |",
        "| --- | --- | --- |",
    ]
    for item in report["missingFilters"]:
        if item["missing"]:
            lines.append(f"| {item['team']} | {item['handle']} | {', '.join(item['missing'])} |")
    if not any(item["missing"] for item in report["missingFilters"]):
        lines.append("| none | none | none |")

    lines.extend(["", "## Player Playoffs Splits", "", "| Team | Player | Overall | Top5 | Top10 | Top20 | Top50 |", "| --- | --- | --- | --- | --- | --- | --- |"])
    for player in report["players"]:
        cells = [format_split(player["splits"][filter_key]) for filter_key in FILTERS]
        lines.append(f"| {player['team']} | {player['handle']} | {' | '.join(cells)} |")

    return "\n".join(lines).strip() + "\n"


def render_typescript_samples(report: dict[str, Any]) -> str:
    lines = [
        "import { HltvRatingSample, HltvRatingFilter } from \"./hltvPlayerSplits2026\";",
        "",
        "export const hltvPlayerPlayoffs2026: Record<string, Partial<Record<HltvRatingFilter, HltvRatingSample>>> = {",
    ]
    for player in report["players"]:
        valid_splits = {
            filter_key: split
            for filter_key, split in player["splits"].items()
            if isinstance(split.get("rating"), (int, float)) and isinstance(split.get("maps"), int)
        }
        if not valid_splits:
            continue
        lines.append(f"  {json.dumps(make_key(player['team'], player['handle']))}: {{")
        for filter_key in FILTERS:
            split = valid_splits.get(filter_key)
            if not split:
                continue
            lines.append(f"    {filter_key}: {{ rating: {split['rating']:.2f}, maps: {split['maps']} }},")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def format_split(split: dict[str, Any]) -> str:
    rating = split.get("rating")
    maps = split.get("maps")
    return f"{rating:.2f} ({maps})" if isinstance(rating, (int, float)) and maps is not None else "-"


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    cleaned = re.sub(r"[^0-9.+-]", "", str(value))
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def make_key(team: str, handle: str) -> str:
    return f"{normalize_name(team)}|{normalize_handle(handle)}"


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("&", "and"))


def normalize_handle(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "", value.lower())


if __name__ == "__main__":
    sys.exit(main())
