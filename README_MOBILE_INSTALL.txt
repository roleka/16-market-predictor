16-MARKET PREDICTOR — MOBILE WEB APP

This is a Progressive Web App (PWA). It can be installed on Android and iPhone from a secure HTTPS website and can then run offline after its first load.

IMPORTANT: A PWA cannot be installed from a ZIP file or ordinary local file:// URL. It must first be hosted at an HTTPS address.

QUICK HOSTING (GitHub Pages):
1. Create/sign in to a GitHub account.
2. Create a new public repository, e.g. 16-market-predictor.
3. Upload ALL files in this folder (index.html, app.js, model.json, features.json, manifest.webmanifest, sw.js, icon.svg).
4. In repository Settings > Pages, select Deploy from a branch, choose main and /root, then Save.
5. Wait for GitHub Pages to publish the site. Open the generated https://...github.io/... address on your phone.

INSTALL:
- Android Chrome: open the HTTPS app address > browser menu ⋮ > Install app (or Add to Home screen).
- iPhone Safari: open the HTTPS app address > Share > Add to Home Screen.

USE:
- Fill the decimal odds in each market group, or import a CSV with Feature,Odds columns.
- Tap Calculate prediction.
- Save results locally on that device or download the result CSV.
- After the first online load, core app files are cached for offline use.

Screenshots can be read automatically (see Screenshot OCR assistant), or enter odds manually / import a CSV.
The fitted model is experimental and trained on synthetic data; it is not a validated betting system.


NEW IN VERSION 1.2:
- Replaced sequential OCR filling with market-aware extraction. The app recognises market headings and maps odds to named features rather than filling fields by number order.
- Supports full-time and first-half 1X2, O/U, double chance, GG/NG, handicap lines, teams-to-score, correct score, incorrect-score proxy, home-team O/U and away-team O/U.
- Overlapping screenshots with identical values are deduplicated. Conflicting values are flagged and skipped. Missing or locked outcomes remain blank.
- The OCR report lists matched features and missing fields. Use Validate & Fill Matched Odds to populate only recognised fields, then inspect the report before calculating.
- OCR still depends on Tesseract.js being available from its CDN on first use; the prediction engine itself remains local.
- Actual-result tracking: save a prediction, then enter the final score to calculate outcome and exact-score accuracy.
- Performance dashboard: calculates hit rates only from logged predictions with actual results.
- Contribution display: lists largest fitted linear-model contributions toward the home side. These are model arithmetic contributions, not causal explanations.
- OCR engine is loaded from a CDN and needs internet access; prediction calculations and saved history remain local.


NEW IN VERSION 1.3:
- UPDATING: upload ALL files, then open the app once while online and close/reopen it.
  The header must show "v1.3". If it still shows the old text, clear the site's storage in Chrome
  (Settings > Site settings > All sites > your github.io address > Clear & reset).
- Service worker now fetches fresh app files when online (offline still uses the cached copy).
  For every future release, change CACHE in sw.js (e.g. 16market-v1.4).
- OCR reads headings with leading symbols/slips: "v 1X2", "v 0/U", "¥ Home Team O/U".
- Goal lines misread as "225", "25" or "2,5" are recognised as 2.5.
- Correct score: each price is taken only from between its own score and the next one.
- Prices that lost their decimal point ("2290" -> 22.90, "153" -> 1.53) are recovered and listed
  under REPAIRED in the report. Check these against the screenshot.
- Screenshot boundaries no longer reset the market, so a row at the top of the next screenshot
  (e.g. O/U 5.5) is kept. Status-bar / header / betslip lines are ignored.
- 2nd-half markets, combo markets (1X2 & O/U) and unused markets no longer leak into full-time fields.
- A single unlabelled O/U price (other side locked) is flagged, not assumed to be Over.
- After filling, you are offered to clear fields not found, so odds from a previous match are not reused.
- Full "Not found" list shown at the top of the report.
- Fixes: CSV from Excel imports correctly; "2 - 1" results count as exact-score hits; feature count read from the model.


NEW IN VERSION 1.4:
- OCR now enlarges small screenshots and converts them to grayscale before reading, and reads the
  page row by row. Tested on 5 VIL vs VCF screenshots: 102 of 103 visible odds read correctly,
  0 wrong (previously 63).
- Unreadable O/U goal lines (e.g. "2.9", "2:5") are taken from row order (0.5, 1.5, 2.5 ...).
- Unreadable Correct Score labels are taken from the grid order, only when the next label confirms it.
- Handicap prices that lost their decimal point are recovered.
- All repaired values are listed under REPAIRED in the report. Check them before calculating.
- Tip: scroll so each row is fully above the Next Round / Betslip bar. A row half-hidden behind it
  is not read. Original screenshots read better than WhatsApp copies.
