#!/usr/bin/env python3
"""Fetch CS pro player photos from Liquipedia (CC-BY-SA) into src/assets/players/.

Pipeline per player handle:
  1) batch query page wikitext -> infobox `|image=` filename
  2) batch query imageinfo -> 256px thumbnail URL
  3) download the thumbnail to src/assets/players/<handle>.jpg|png

Respects Liquipedia API terms: descriptive User-Agent, gzip, <=1 req/2s, downloads spaced out.
Writes /tmp/photo-map.json (handle -> saved filename) and prints a coverage report.

Prereq — generate the player list this reads (id/handle/team for every roster entry):
  node --import tsx --import ./scripts/register-stub.mjs -e '\
    import {hltvTop20Rosters} from "./src/hltvTop20.ts"; import {writeFileSync} from "node:fs"; \
    const rows=[]; hltvTop20Rosters.forEach(r=>r.players.forEach(p=>rows.push({id:p.id,handle:p.handle,real:p.realName,team:r.name,country:p.country}))); \
    writeFileSync("/tmp/players.json", JSON.stringify(rows));'
Then: python3 scripts/fetch-player-photos.py   (LIMIT=N env to test on the first N handles)
"""
import json, urllib.request, urllib.parse, gzip, time, os, re, sys, ssl

UA = "MajorDraftLab/1.0 (personal CS sim fan project; contact zhenbangli@gmail.com)"
API = "https://liquipedia.net/counterstrike/api.php"
OUT = "src/assets/players"
LIMIT = int(os.environ.get("LIMIT", "0"))  # 0 = all
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE  # python framework install lacks CA bundle; these are public images

def api_get(params):
    params = {**params, "format": "json"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=40, context=CTX) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
    return json.loads(data)

def norm_title(t):
    return t.lower().replace("_", " ").strip()

players = json.load(open("/tmp/players.json"))
by_handle = {}
for p in players:
    by_handle.setdefault(p["handle"], []).append(p)
handles = list(by_handle.keys())
if LIMIT:
    handles = handles[:LIMIT]

# normalized handle title -> handle (MediaWiki capitalises first letter; we match case-insensitively)
hnorm = {norm_title(h): h for h in handles}

# --- Step 1: wikitext -> infobox image filename ---
handle_image = {}  # handle -> "File:..."
for i in range(0, len(handles), 40):
    batch = handles[i:i + 40]
    d = api_get({"action": "query", "prop": "revisions", "rvprop": "content",
                 "rvslots": "main", "titles": "|".join(batch), "redirects": 1})
    q = d.get("query", {})
    # map returned/redirected titles back to our handle
    alias = {}
    for n in q.get("normalized", []):
        alias[norm_title(n["to"])] = hnorm.get(norm_title(n["from"]))
    for r in q.get("redirects", []):
        src = norm_title(r["from"])
        alias[norm_title(r["to"])] = alias.get(src) or hnorm.get(src)
    for pg in q.get("pages", {}).values():
        title = pg.get("title", "")
        h = alias.get(norm_title(title)) or hnorm.get(norm_title(title))
        if not h or "revisions" not in pg:
            continue
        txt = pg["revisions"][0]["slots"]["main"]["*"]
        m = re.search(r"\n\s*\|\s*image\s*=\s*([^\n|]+)", txt)
        if m and m.group(1).strip() and not m.group(1).strip().lower().startswith("{{"):
            handle_image[h] = "File:" + m.group(1).strip()
    time.sleep(2)

# --- Step 2: imageinfo -> thumbnail url ---
fnorm = {}  # normalized file title -> [handles]
for h, ft in handle_image.items():
    fnorm.setdefault(norm_title(ft), []).append(h)
file_titles = list({ft for ft in handle_image.values()})
handle_url = {}
for i in range(0, len(file_titles), 40):
    batch = file_titles[i:i + 40]
    d = api_get({"action": "query", "prop": "imageinfo", "iiprop": "url",
                 "iiurlwidth": 256, "titles": "|".join(batch)})
    q = d.get("query", {})
    for pg in q.get("pages", {}).values():
        ii = pg.get("imageinfo")
        if not ii:
            continue
        url = ii[0].get("thumburl") or ii[0].get("url")
        for h in fnorm.get(norm_title(pg.get("title", "")), []):
            handle_url[h] = url
    time.sleep(2)

# --- Step 3: download ---
os.makedirs(OUT, exist_ok=True)
saved = {}
for h, url in handle_url.items():
    ext = ".png" if ".png" in url.lower() else ".jpg"
    slug = re.sub(r"[^a-z0-9]+", "-", h.lower()).strip("-") or "player"
    path = f"{OUT}/{slug}{ext}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://liquipedia.net/counterstrike/"})
        with urllib.request.urlopen(req, timeout=40, context=CTX) as r:
            blob = r.read()
        if len(blob) < 600:  # too small => probably an error page
            raise ValueError(f"tiny ({len(blob)}b)")
        with open(path, "wb") as f:
            f.write(blob)
        saved[h] = f"{slug}{ext}"
    except Exception as e:
        print(f"  download FAIL {h}: {e}", file=sys.stderr)
    time.sleep(0.5)

json.dump(saved, open("/tmp/photo-map.json", "w"))
missing = [h for h in handles if h not in saved]
print(f"\n=== coverage: {len(saved)}/{len(handles)} handles ===")
print("MISSING:", ", ".join(missing) if missing else "none")
