#!/usr/bin/env python3
"""
Generates versions/<MB_VERSION>/data/zip-cost-of-living.json (default v4).

WHY THIS EXISTS
---------------
The output is ~450KB of derived numbers covering every ZIP code in the country.
Without the generator beside it, nobody can audit where any single figure came
from. This file IS the audit trail.

It is a DATA AUTHORING TOOL, not a build step. Nothing about opening index.html
depends on it having been run — run it by hand when refreshing the sources, then
run scripts/wrap-data.sh to regenerate the .js wrapper.

    python3 scripts/build-cost-of-living.py

WHAT IT REPLACED
----------------
The app used to resolve a ZIP through a 3-digit prefix to one of four
cost-of-living tiers (peer-benchmarks.json colTiers). Three things were wrong
with that, and they compounded:

  1. Every ZIP sharing a prefix-tier was identical. Manhattan, Palo Alto, Santa
     Clara and Los Angeles all resolved to the same "very_high" figures.
  2. That tier caps Housing at 1.85, so nowhere in America could read higher.
  3. The headline index averaged all twelve categories unweighted, so Housing —
     the only category that really swings — was one twelfth of it.

Net effect: Santa Clara read 121% of national and Rogers, Arkansas read 111%.
BEA says 112.9 and 91.0, with housing at 213.0 against 75.8.

SOURCES (all public, no API key)
--------------------------------
  BEA Regional Price Parities, 2023 — the US government's own cost-of-living
      index by place, 100 = national. Published per metro area plus a
      metro/nonmetro portion for each state, broken into All items, Goods,
      Services: Housing, Services: Utilities and Services: Other.
  Zillow ZORI  — typical observed RENT by county. The right basis for a
      monthly-spend model; covers ~1,390 counties.
  Zillow ZHVI  — typical home VALUE by county. Housing fallback where ZORI has
      no coverage; ~3,070 counties. Also supplies the county -> metro mapping
      that joins counties to BEA geographies.
  EIA          — average residential electricity price by state, cents/kWh.
  scpike/us-state-county-zip — ZIP -> county, US Census derived.

Figures are prototype-grade (D19): editable, not a live feed, not advice.
"""

import collections
import csv
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "versions", os.environ.get("MB_VERSION", "v4"),
                   "data", "zip-cost-of-living.json")
CACHE = os.environ.get("COL_CACHE", os.path.join(tempfile.gettempdir(), "moneybuddy-col-cache"))

RPP_YEAR = "2023"

# A county at three times its region's typical rent is a data artifact far more
# often than it is a real cost of living, so the ratio is clamped.
HOUSING_CLAMP = (0.55, 1.9)
# Home values are far more dispersed than rents; this damps a ZHVI-derived ratio
# into a rent-like one. Counties carrying both series land within a few percent.
ZHVI_EXPONENT = 0.6

SOURCES = {
    "rpp.zip":  "https://apps.bea.gov/regional/zip/RPP.zip",
    "zhvi.csv": "https://files.zillowstatic.com/research/public_csvs/zhvi/"
                "County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
    "zori.csv": "https://files.zillowstatic.com/research/public_csvs/zori/"
                "County_zori_uc_sfrcondomfr_sm_month.csv",
    "elec.xlsx": "https://www.eia.gov/electricity/data/state/avgprice_annual.xlsx",
    "geo.csv":  "https://raw.githubusercontent.com/scpike/us-state-county-zip/master/geo-data.csv",
}

# The app's flat taxonomy (js/taxonomy.js). Order matters only for readability.
CATEGORIES = ["Housing", "Groceries", "Dining out", "Transport",
              "Utilities", "Subscriptions", "Health", "Personal care",
              "Entertainment", "Shopping", "Debt payments", "Other"]

# Which BEA bucket governs each category's regional price level.
#
# "flat" means the category is priced nationally and does not vary by where you
# live: a streaming subscription and a loan repayment cost the same in Palo Alto
# as in Helena. The old tier table already encoded this for Subscriptions
# (1.0 in every tier) and it was right.
BUCKET = {
    "Housing":       "housing",
    "Utilities":     "utilities",
    "Groceries":     "goods",
    "Shopping":      "goods",
    "Transport":     "goods",
    "Dining out":    "otherServices",
    "Health":        "otherServices",
    "Personal care": "otherServices",
    "Entertainment": "otherServices",
    "Subscriptions": "flat",
    "Debt payments": "flat",
    "Other":         "otherServices",
}

# Used only to split each BEA bucket's fitted weight across the categories
# inside it, so all that matters is their size RELATIVE to their bucket-mates —
# the absolute scale is irrelevant and cancels.
#
# The resulting per-category weights are therefore shares of BEA's basket, which
# is PCE, not household out-of-pocket spending. That is why Health comes out
# near Housing: PCE counts employer- and government-paid healthcare, which a
# household never sees on a bank statement. Only the Housing and Utilities
# weights are ever load-bearing (they are alone in their buckets and are the
# only two categories carrying a local modifier); the rest are published for
# transparency.
SHARE = {
    "Housing": 21.4, "Utilities": 6.6, "Groceries": 7.4, "Dining out": 5.5,
    "Transport": 17.0, "Health": 8.0, "Entertainment": 4.7, "Shopping": 6.5,
    "Personal care": 1.2, "Subscriptions": 2.0, "Debt payments": 5.0, "Other": 4.7,
}

STATE_NAME = dict(pair.split(" ", 1) for pair in (
    "AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|"
    "CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|"
    "HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|"
    "LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|"
    "MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|"
    "NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|"
    "OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|"
    "SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|"
    "VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming"
).split("|"))


def median(values):
    s = sorted(values)
    n = len(s)
    if not n:
        return None
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def log(*a):
    print(*a, file=sys.stderr)


def fetch(name):
    """Download once into CACHE. Re-running is cheap and offline-safe."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    log("  fetching %s ..." % name)
    subprocess.run(["curl", "-sSL", "--max-time", "180", "-o", path, SOURCES[name]],
                   check=True)
    if os.path.getsize(path) == 0:
        raise SystemExit("error: %s downloaded empty (source may be blocking)" % name)
    return path


def norm_county(name):
    """One spelling per county. The sources disagree on 'St.' vs 'Saint'."""
    n = (name or "").strip()
    n = re.sub(r"\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$", "", n)
    n = n.replace("St. ", "Saint ").replace("Ste. ", "Sainte ")
    return n.strip()


# ── BEA ──────────────────────────────────────────────────────────────────────

def load_rpp():
    """{geoName: {all, housing, utilities, goods, otherServices}} for metros and
    each state's metro/nonmetro portions."""
    z = zipfile.ZipFile(fetch("rpp.zip"))
    field = {
        "RPPs: All items":            "all",
        "RPPs: Services: Housing":    "housing",
        "RPPs: Services: Utilities":  "utilities",
        "RPPs: Goods":                "goods",
        "RPPs: Services: Other":      "otherServices",
    }
    out = collections.defaultdict(dict)
    for member in ("MARPP_MSA_2008_2023.csv", "PARPP_PORT_2008_2023.csv"):
        stream = io.TextIOWrapper(z.open(member), "utf-8-sig")
        for row in csv.DictReader(stream):
            key = field.get((row.get("Description") or "").strip())
            geo = (row.get("GeoName") or "").strip()
            val = row.get(RPP_YEAR)
            if not key or not geo or not val:
                continue
            try:
                out[geo][key] = float(val)
            except ValueError:
                pass
    # Only keep geographies with the full set — a partial row would silently
    # contribute a 1.0 for whatever is missing.
    return {g: v for g, v in out.items() if len(v) == len(field)}


def solve_bucket_weights(rpp):
    """
    BEA does not publish the weights behind its All-items index, so recover them:
    find w over (housing, utilities, goods, otherServices) that best reproduces
    published All-items across every geography, by least squares.

    These weights are NOT used to rebuild the headline from scratch — see
    §"the composite" below. They are used to scale the DEVIATION a local modifier
    introduces, which is why a good-but-imperfect fit is fine here.

    The fit lands at mean error under a point. It cannot be exact, because BEA's
    real weights are place-specific: where housing is expensive people spend a
    larger share of income on it, so San Jose's true housing weight is higher
    than the national one. That is precisely why the composite is anchored on
    BEA's published figure rather than recomputed from these weights.

    Four unknowns, ~490 equations. Normal equations by hand; numpy is not
    available on every machine this repo runs on and this is a 4x4 solve.
    """
    keys = ["housing", "utilities", "goods", "otherServices"]
    rows = [([v[k] for k in keys], v["all"]) for v in rpp.values()]
    n = len(keys)
    ata = [[sum(r[i] * r[j] for r, _ in rows) for j in range(n)] for i in range(n)]
    atb = [sum(r[i] * y for r, y in rows) for i in range(n)]

    # Gaussian elimination with partial pivoting.
    m = [ata[i][:] + [atb[i]] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[piv] = m[piv], m[col]
        for r in range(n):
            if r == col or m[col][col] == 0:
                continue
            f = m[r][col] / m[col][col]
            for c in range(col, n + 1):
                m[r][c] -= f * m[col][c]
    w = [m[i][n] / m[i][i] for i in range(n)]
    total = sum(w)
    weights = {k: w[i] / total for i, k in enumerate(keys)}

    errs = sorted(abs(sum(v[k] * weights[k] for k in keys) - v["all"]) for v in rpp.values())
    med = median(errs)
    log("  fitted bucket weights: " + ", ".join("%s %.3f" % (k, weights[k]) for k in keys))
    log("  fit vs published All items: median %.2f  p95 %.2f  max %.2f points"
        % (med, errs[int(0.95 * len(errs))], errs[-1]))
    # A sanity gate on the shape of the fit, not an exactness gate. If the median
    # blows out, the bucket mapping or the source columns have moved.
    if med > 1.5:
        raise SystemExit("error: bucket weights do not track BEA All-items "
                         "(median residual %.2f) — check the source columns" % med)
    return weights, med


def category_weights(bucket_weights):
    """
    Per-category weight for the headline composite.

    Each BEA bucket's fitted weight is split across the categories inside it in
    proportion to household spend. `flat` categories get 0: they sit outside
    BEA's priced basket entirely and never carry a local modifier, so they can
    never contribute a deviation.

    These weights scale the DEVIATION a local modifier introduces, not the whole
    index — see the composite note in the output.
    """
    out = {}
    for bucket in sorted(set(BUCKET.values())):
        members = [c for c in CATEGORIES if BUCKET[c] == bucket]
        if bucket == "flat":
            for c in members:
                out[c] = 0.0
            continue
        share_total = sum(SHARE[c] for c in members)
        for c in members:
            out[c] = bucket_weights[bucket] * SHARE[c] / share_total
    return {c: round(out[c], 5) for c in CATEGORIES}


# ── Zillow / EIA ─────────────────────────────────────────────────────────────

def latest_by_county(path):
    """{(ST, County): value} from a Zillow county CSV, newest month with data."""
    rows = list(csv.DictReader(open(path)))
    months = [c for c in rows[0] if c[:2] == "20"]
    out, used = {}, None
    for r in rows:
        for m in reversed(months):
            if r.get(m):
                out[(r["State"], norm_county(r["RegionName"]))] = float(r[m])
                used = used or m
                break
    return out, used


def county_metro(path):
    """{(ST, County): metro name} — Zillow ships the CBSA name per county, which
    is what joins a county to its BEA geography."""
    out = {}
    for r in csv.DictReader(open(path)):
        out[(r["State"], norm_county(r["RegionName"]))] = (r.get("Metro") or "").strip()
    return out


def electricity_by_state(path):
    """{ST: cents/kWh residential}, most recent year in the workbook.

    An .xlsx is a zip of XML, so this reads it with the standard library —
    openpyxl is not installed on every machine this repo runs on.
    """
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
            shared.append("".join(t.text or "" for t in si.iter(ns + "t")))
    sheet = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")][0]

    rows = []
    for row in ET.fromstring(z.read(sheet)).iter(ns + "row"):
        cells = []
        for c in row.iter(ns + "c"):
            v = c.find(ns + "v")
            if v is None:
                cells.append("")
            else:
                cells.append(shared[int(v.text)] if c.get("t") == "s" else v.text)
        rows.append(cells)

    header = next(i for i, r in enumerate(rows) if "Residential" in r)
    idx = {name: rows[header].index(name) for name in ("Year", "State", "Residential")}
    sector = rows[header].index("Industry Sector Category")

    best = {}
    for r in rows[header + 1:]:
        if len(r) <= max(idx.values()):
            continue
        if "Total Electric Industry" not in str(r[sector]):
            continue
        st, year = str(r[idx["State"]]).strip(), str(r[idx["Year"]]).strip()
        try:
            price, year = float(r[idx["Residential"]]), int(year)
        except ValueError:
            continue
        if price <= 0:
            continue
        if st not in best or year > best[st][0]:
            best[st] = (year, price)
    latest = max(y for y, _ in best.values())
    return {st: p for st, (y, p) in best.items()}, latest


# ── Build ────────────────────────────────────────────────────────────────────

def main():
    log("Building zip-cost-of-living.json")
    log("  cache: %s" % CACHE)

    rpp = load_rpp()
    log("  BEA %s: %d geographies" % (RPP_YEAR, len(rpp)))
    bucket_w, fit_median = solve_bucket_weights(rpp)
    weights = category_weights(bucket_w)

    zhvi_path, zori_path = fetch("zhvi.csv"), fetch("zori.csv")
    zhvi, zhvi_month = latest_by_county(zhvi_path)
    zori, zori_month = latest_by_county(zori_path)
    metro_of = county_metro(zhvi_path)
    elec, elec_year = electricity_by_state(fetch("elec.xlsx"))
    elec_national = median(elec.values())
    log("  Zillow ZHVI %s (%d counties) · ZORI %s (%d) · EIA %s (%d states)"
        % (zhvi_month, len(zhvi), zori_month, len(zori), elec_year, len(elec)))

    by_prefix = {}
    for name in rpp:
        by_prefix.setdefault(name.split(" (")[0], name)

    def geo_for(st, county):
        m = metro_of.get((st, county), "")
        if m and m in by_prefix:
            return by_prefix[m]
        nonmetro = STATE_NAME.get(st, "") + " (Nonmetropolitan Portion)"
        return nonmetro if nonmetro in rpp else None

    # ── zip -> (geo, county) ──
    geo_rows = [r for r in csv.DictReader(open(fetch("geo.csv"))) if r["zipcode"].isdigit()]
    all_zips = {r["zipcode"] for r in geo_rows}
    claims = collections.defaultdict(list)
    for r in geo_rows:
        st, county = r["state_abbr"], norm_county(r["county"])
        g = geo_for(st, county)
        if g and (g, st, county) not in claims[r["zipcode"]]:
            claims[r["zipcode"]].append((g, st, county))

    cities = {r["zipcode"]: r["city"] for r in geo_rows if r.get("city")}
    zips, shared_zips, unresolved = {}, {}, sorted(all_zips - set(claims))
    for zp, cands in claims.items():
        cands = sorted(cands)
        chosen = cands[0]
        zips[zp] = chosen
        if len(cands) > 1:
            shared_zips[zp] = {
                "city": cities.get(zp, ""),
                "resolvedTo": "%s:%s" % (chosen[1], chosen[2]),
                "alsoClaimedBy": ["%s:%s" % (c[1], c[2]) for c in cands[1:]],
            }
    log("  ZIPs resolved: %d of %d" % (len(zips), len(all_zips)))
    if unresolved:
        raise SystemExit("error: %d ZIPs did not resolve, e.g. %s"
                         % (len(unresolved), unresolved[:5]))

    # ── geos ──
    # Numbered first, because a county record names the geography it sits in.
    geos, geo_id_of = {}, {}
    for i, name in enumerate(sorted({c[0] for c in zips.values()})):
        gid = str(i)
        geo_id_of[name] = gid
        r = rpp[name]
        geos[gid] = {
            "name": name,
            "all":           round(r["all"], 1),
            "housing":       round(r["housing"], 1),
            "utilities":     round(r["utilities"], 1),
            "goods":         round(r["goods"], 1),
            "otherServices": round(r["otherServices"], 1),
        }

    # ── county housing ratio, against its OWN BEA region ──
    # A county is expensive or cheap RELATIVE TO ITS REGION. Comparing it to the
    # national median instead would double-count what BEA already says about the
    # region, and Manhattan would be counted as expensive twice over.
    used_counties = {(c[1], c[2]) for c in zips.values()}
    region_rents = collections.defaultdict(list)
    rent_of = {}
    for key in used_counties:
        if key in zori:
            rent_of[key] = (zori[key], "zori")
        elif key in zhvi:
            rent_of[key] = (zhvi[key], "zhvi")
    for key, (val, src) in rent_of.items():
        g = geo_for(key[0], key[1])
        if g:
            region_rents[(g, src)].append(val)
    region_median = {k: median(v) for k, v in region_rents.items()}

    # County -> BEA geography is a function of the county alone, so a ZIP only
    # ever needs to name its county: the geography comes with it. That is what
    # keeps the ZIP map to one small integer per row rather than a repeated
    # geography id and a repeated county string, across 31,913 rows.
    counties, county_id = {}, {}
    for i, key in enumerate(sorted(used_counties)):
        st, name = key
        county_id[key] = i
        g = geo_for(st, name)
        entry = {"state": st, "name": name, "geo": geo_id_of[g]}
        got = rent_of.get(key)
        if got and region_median.get((g, got[1])):
            val, src = got
            raw = val / region_median[(g, src)]
            ratio = raw if src == "zori" else raw ** ZHVI_EXPONENT
            entry["housingRatio"] = round(max(HOUSING_CLAMP[0], min(HOUSING_CLAMP[1], ratio)), 4)
            # Which key is present IS the provenance — `rent` means ZORI
            # measured it, `homeValue` means it was inferred from ZHVI.
            entry["rent" if src == "zori" else "homeValue"] = round(val)
        else:
            entry["housingRatio"] = 1.0
        counties[str(i)] = entry

    # ── state electricity ratio ──
    states = {}
    for st in sorted({c[1] for c in zips.values()}):
        p = elec.get(st)
        states[st] = {"centsPerKwh": round(p, 2), "utilitiesRatio": round(p / elec_national, 4)} \
            if p else {"utilitiesRatio": 1.0}

    out = collections.OrderedDict()
    out["_note"] = (
        "Cost of living for every ZIP code in the United States. Replaces a 3-digit prefix lookup "
        "against four hand-set tiers, under which Manhattan, Palo Alto, Santa Clara and Los Angeles "
        "were all the same number, nowhere could exceed 1.85x national on housing, and the headline "
        "averaged twelve categories unweighted so housing counted for one twelfth of it. Santa Clara "
        "read 121% of national and Rogers, Arkansas read 111%; BEA says 112.9 and 91.0, with housing "
        "at 213.0 against 75.8. Regenerate with scripts/build-cost-of-living.py, then "
        "scripts/wrap-data.sh. Prototype-grade (D19) — editable, not a live feed, not advice."
    )
    out["method"] = {
        "_note": (
            "A ZIP resolves to its county, the county to a BEA geography (its metro area, or its "
            "state's nonmetropolitan portion). The BEA figure sets the regional price level per "
            "category; a per-category local modifier then adjusts it. Each modifier comes from the "
            "source that actually governs that category — housing from county rents, utilities from "
            "state electricity prices — never one ratio applied to all twelve, which would imply "
            "groceries track house prices."
        ),
        "sources": {
            "regional": "BEA Regional Price Parities " + RPP_YEAR + ", 100 = national. "
                        "apps.bea.gov/regional/zip/RPP.zip",
            "housing":  "Zillow ZORI (observed rent) " + str(zori_month) + ", falling back to "
                        "ZHVI (home value) " + str(zhvi_month) + " where ZORI has no county coverage.",
            "utilities": "EIA average residential electricity price by state, " + str(elec_year) +
                         ", cents/kWh.",
            "zipToCounty": "scpike/us-state-county-zip (US Census derived).",
        },
        "categoryBucket": BUCKET,
        "_categoryBucketNote": (
            "Which BEA component prices each category. 'flat' means priced nationally and never "
            "adjusted: a streaming subscription and a loan repayment cost the same everywhere. The "
            "old tier table already had Subscriptions at 1.0 in every tier and that was right."
        ),
        "localModifier": {
            "Housing":   "county — rent relative to the median rent of its own BEA region",
            "Utilities": "state — residential electricity price relative to the national median",
        },
        "_localModifierNote": (
            "Only these two. There is no credible county-level feed for grocery, restaurant or "
            "healthcare prices, so those categories carry the BEA regional figure unmodified. "
            "Fabricating per-county food variation would produce a plausible-looking wrong number, "
            "which is the failure mode this whole file exists to remove. The housing ratio is "
            "measured against the county's OWN region, not the nation — BEA has already priced the "
            "region, and comparing to the nation would count it twice."
        ),
        "weights": weights,
        "composite": "bea_all_plus_weighted_deltas",
        "_compositeNote": (
            "The headline cost-of-living index is BEA's own published All-items figure for the "
            "geography, PLUS the weighted deviation each local modifier introduces:\n"
            "    index = all/100 + SUM over categories of weight[c] * (final[c] - base[c])\n"
            "where base[c] is the unmodified BEA bucket figure for that category and final[c] "
            "includes its local modifier. Where no modifier applies the sum is zero and the index IS "
            "BEA's number, exactly. This is deliberately NOT a recomputation from the weights below: "
            "BEA's real weights are place-specific — where housing is expensive people spend a larger "
            "share on it — so a single national weight set reproduces published All-items to about "
            "half a point typically but is off by ten in San Jose. Anchoring on the published figure "
            "and weighting only the deviation is exact where it can be and honest where it cannot."
        ),
        "_weightsNote": (
            "How much a local modifier moves the headline. BEA does not publish the weights behind its All-items "
            "index, so they were recovered by least squares across all " + str(len(rpp)) +
            " geographies (median residual " + ("%.2f" % fit_median) + " points) and then split "
            "across the categories in each bucket by household spend share. Housing carries roughly "
            "a sixth of the basket and Subscriptions none of it — which is why the old unweighted "
            "mean of twelve flattened every real difference toward 1.0. These are shares of BEA's "
            "basket, which is PCE rather than household out-of-pocket spending: Health lands near "
            "Housing because PCE counts employer- and government-paid healthcare. Only the Housing "
            "and Utilities weights are load-bearing — they are alone in their buckets and are the "
            "only two categories carrying a local modifier."
        ),
        "coverage": (
            "The 50 states and DC. BEA publishes no Regional Price Parities for Puerto Rico, Guam, "
            "the US Virgin Islands or the Northern Mariana Islands, and Zillow covers no counties "
            "there, so a territory ZIP falls through to the national average and reports itself "
            "unsupported rather than being given an invented figure."
        ),
        "prefixFallback": (
            "`prefixes` maps a 3-digit prefix to the county most of its ZIPs sit in. It catches "
            "PO-box-only and 'unique' ZIPs that no county dataset lists — without it those fall "
            "through to the old four-tier table and read as the national average."
        ),
        "housingRatioClamp": list(HOUSING_CLAMP),
        "zhviExponent": ZHVI_EXPONENT,
        "_zhviExponentNote": (
            "Home values are far more dispersed than rents, so a ZHVI-derived ratio is damped by "
            "this exponent before use. Counties with both series land within a few percent."
        ),
    }
    out["bleedOver"] = {
        "_note": (
            "ZIPs whose delivery area is claimed by counties in two different states. All appear in "
            "`zips` and resolve normally; this records the ambiguity rather than hiding it."
        ),
        "sharedZips": dict(sorted(shared_zips.items())),
        "splitCities": {
            "Texarkana": {"AR": ["71854"], "TX": ["75501", "75503"]},
            "West Memphis / Memphis": {"AR": ["72301"], "TN": ["38103"]},
            "Kansas City": {"KS": ["66101"], "MO": ["64101"]},
        },
    }
    # ── 3-digit prefix fallback ──
    # geo.csv carries ~32k ZIPs; the USPS also issues PO-box-only and "unique"
    # ZIPs that no county dataset lists. Those used to drop through to the old
    # four-tier table and read as the national average — Syracuse's 13201 came
    # out at exactly 100%. Mapping each 3-digit prefix to the county most of its
    # ZIPs belong to puts them in the right metro instead. Real precision for
    # the ZIPs we have; a good neighbour for the ones we do not.
    prefix_counts = collections.defaultdict(collections.Counter)
    for zp, (g, st, c) in zips.items():
        prefix_counts[zp[:3]][county_id[(st, c)]] += 1
    prefixes = {p: counter.most_common(1)[0][0] for p, counter in sorted(prefix_counts.items())}
    log("  prefix fallbacks: %d" % len(prefixes))

    out["geos"] = geos
    out["counties"] = counties
    out["states"] = states
    out["prefixes"] = prefixes
    out["zips"] = {z: county_id[(st, c)] for z, (g, st, c) in sorted(zips.items())}

    # Everything but `zips` is pretty-printed so the model stays readable and
    # diffable. `zips` is 31,913 rows of pure lookup — one per line would add a
    # megabyte of whitespace to the one section nobody reads by eye.
    def block(name, mapping, per_line):
        """One entry per line: readable and diffable without a megabyte of
        whitespace. `geos` and `counties` are thousands of small flat records —
        indenting each field puts five lines where one belongs."""
        if not per_line:
            return ' "%s": %s' % (name, json.dumps(mapping, separators=(",", ":")))
        rows = ',\n'.join('  "%s": %s' % (k, json.dumps(v, separators=(",", ": ")))
                          for k, v in mapping.items())
        return ' "%s": {\n%s\n }' % (name, rows)

    head = {k: out[k] for k in ("_note", "method", "bleedOver", "states")}
    body = json.dumps(head, indent=1, sort_keys=False)
    assert body.endswith("\n}")
    parts = [body[:-2],
             block("geos", out["geos"], True),
             block("counties", out["counties"], True),
             block("prefixes", out["prefixes"], False),
             block("zips", out["zips"], False)]
    with open(OUT, "w") as fh:
        fh.write(",\n".join(parts) + "\n}\n")
    log("  wrote %s (%.0f KB)" % (OUT, os.path.getsize(OUT) / 1024))
    log("  %d geographies · %d counties · %d ZIPs · %d shared"
        % (len(geos), len(counties), len(zips), len(shared_zips)))
    log("\nNow run: bash scripts/wrap-data.sh")


if __name__ == "__main__":
    main()
