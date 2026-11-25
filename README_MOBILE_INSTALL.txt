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

The app does not currently OCR screenshots automatically. Enter odds manually or import a prepared CSV.
The fitted model is experimental and trained on synthetic data; it is not a validated betting system.


NEW IN VERSION 1.1:
- Screenshot OCR assistant: select image screenshots, run OCR, review recognized text, optionally fill detected odds sequentially into feature order. This sequential fill is only appropriate if screenshot market order exactly matches model feature order. Check all fields manually.
- Actual-result tracking: save a prediction, then enter the final score to calculate outcome and exact-score accuracy.
- Performance dashboard: calculates hit rates only from logged predictions with actual results.
- Contribution display: lists largest fitted linear-model contributions toward the home side. These are model arithmetic contributions, not causal explanations.
- OCR engine is loaded from a CDN and needs internet access; prediction calculations and saved history remain local.
