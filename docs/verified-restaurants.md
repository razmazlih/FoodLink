# Verified Israeli restaurant catalog

Checked on 2026-10-28. `data/verified_restaurants.json` contains three real
branches and a selection of eight dishes per branch (24 dishes total), with
prices in integer agorot. This is a partial menu, not a complete menu import.
Prices are those published by the restaurant when checked, may change, and are
not verified delivery prices. No opening hours, photos, descriptions, ownership,
or delivery partnership are inferred. Imported items are reference-only and
cannot be ordered until an authorized operator connects the real restaurant.

| Branch | Official menu | Official branch/address source |
| --- | --- | --- |
| Café Noir, Ahad Ha'am 43, Tel Aviv–Yafo | https://www.cafenoir.co.il/menu/food | https://www.cafenoir.co.il/ |
| Goocha, Dizengoff 171, Tel Aviv–Yafo | https://www.goocha.co.il/wp-content/uploads/2026/09/תפריט-קטן-עדכון-קיץ-26-עברית.pdf | https://www.goocha.co.il/גוצה-דיזנגוף/ |
| Raffaello Ein Shemer, Alonit Fashion complex, Ein Iron | https://www.raffaello.co.il/einshemer/main_einshemer | https://www.raffaello.co.il/branches/einshemer |

The Raffaello branch is branded “Ein Shemer”; its official page places the
complex in Ein Iron. Goocha's linked PDF is the Summer 2026 menu. Restaurant
headers display the source link, verification date, and price context in the app.

Validate without credentials or writes:

```sh
python3 scripts/import_verified_restaurants.py
```

Import with existing Application Default Credentials:

```sh
UserBase/venv/bin/python scripts/import_verified_restaurants.py --apply --project foodlink-razmaz
```

The importer uses atomic per-branch transactions, numeric counters and branch
uniqueness records. Repeating identical data makes no writes. Updates replace
only menu records tracked by this importer. Existing unrelated restaurants and
menus are preserved. To refresh prices, recheck each official source and update
the data file and verification date before importing again. Cloud API services
must reload the changed Python source, and UI bundles must be rebuilt/deployed
for source notices to appear in an already running deployment.
