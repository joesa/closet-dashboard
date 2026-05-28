#!/usr/bin/env python3
"""Fetch US cities from Census Bureau and generate SQL migration."""
import csv, io, json, re, urllib.request

URL = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/cities/totals/sub-est2023.csv"

print("Downloading Census data...")
resp = urllib.request.urlopen(URL)
text = resp.read().decode("latin-1")
reader = csv.DictReader(io.StringIO(text))

# Suffixes to strip, longest first so "city and borough" matches before "city"
SUFFIXES = [
    " city and borough", " city (balance)", " municipality",
    " city", " town", " village", " CDP", " borough",
]

def clean_name(raw: str) -> str:
    """Strip Census legal suffixes and parenthetical notes."""
    name = raw.strip()
    # Remove trailing parenthetical like " (pt.)" or " (balance)"
    name = re.sub(r"\s*\(.*?\)\s*$", "", name)
    for suffix in SUFFIXES:
        if name.lower().endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name.strip()

# SUMLEV 162 = incorporated place
states = {}
for row in reader:
    if row.get("SUMLEV") != "162":
        continue
    pop = int(row.get("POPESTIMATE2023") or row.get("POPESTIMATE2022") or "0")
    if pop < 10000:
        continue
    st = row.get("STNAME", "")
    name = clean_name(row.get("NAME", ""))
    if not st or not name:
        continue
    states.setdefault(st, []).append((name, pop))

# State name -> code mapping
CODES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
    "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    "District of Columbia": "DC", "Puerto Rico": "PR",
}

out = "supabase/migrations/20260528000000_comprehensive_us_cities.sql"
with open(out, "w") as f:
    f.write("-- Comprehensive US city catalog (pop >= 10 000, Census 2023)\n")
    f.write("truncate table public.scraper_us_state_catalog;\n\n")
    total = 0
    for st_name in sorted(CODES.keys()):
        code = CODES[st_name]
        cities_raw = states.get(st_name, [])
        # Sort by population desc, take city names sorted alpha
        names = sorted(set(c[0] for c in cities_raw))
        if not names:
            names = []
        total += len(names)
        cities_json = json.dumps(names).replace("'", "''")
        sql_name = st_name.replace("'", "''")
        f.write(f"insert into public.scraper_us_state_catalog (state_code, state_name, cities) values ('{code}', '{sql_name}', '{cities_json}');\n")
    print(f"Wrote {total} cities across {len(CODES)} states to {out}")
