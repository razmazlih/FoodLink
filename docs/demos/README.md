# FoodLink: 40-second walkthrough

[Watch in your browser](https://foodlink-front.onrender.com/demo.html) · [Open or download MP4](https://foodlink-front.onrender.com/recruiter-walkthrough.mp4) · [Project overview](../../README.md)

An edited screenshot walkthrough for recruiters: product workflow, implementation choices, and clearly labeled demo scope. Full HD, 40 seconds, English on-screen text, no audio. Prepared November 9, 2026, using authentic screenshots captured November 6, 2026.

Actual public-site captures of the reference catalog. Restaurants are not connected ordering partners; no live order or payment is demonstrated.

The engineering segment explains server-owned prices, integer cents and transactional totals. The [historical refactoring record](../verification.md) documents duplicate cart writes; the [cart regression](../../frontend/src/refactor.test.jsx) checks one quantity mutation per decrement. Tests were not rerun to create this video. Local emulator order flows are documented separately.

[Capture provenance](../screenshots/README.md)
