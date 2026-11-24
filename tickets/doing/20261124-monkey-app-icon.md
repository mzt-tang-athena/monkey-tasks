---
title: The app icon is the operator's monkey
created: 2026-11-24
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The launcher icon is the matcha tile with a white tick (ADR
`20261118-app-icon`). The operator drew a monkey face on 2026-11-24 and
picked it after a few rounds. The draft is a Python script in
`~/code/monkey-tasks/design/logo/`.

The face is a bookmark turned over: a rectangle with a V cut into its
top. A domed fur cap fills the V. Two dot eyes sit below the cap, and
oval ears with inner ears sit behind the head. A thin brown line
outlines the mark. The colours are Flexoki only:

- Background yellow-300 `#DFB431`, waves yellow-400 `#D0A215`.
- Fur orange-700 `#9D4310`, outline orange-800 `#71320D`.
- Face orange-50 `#FFE7CE`, inner ear orange-100 `#FED3AF`.
- Eyes orange-950 `#27180E`.

The background is soft diagonal waves, one shade off the tile. The
themed layer is the line drawing alone, with the ear lines hidden
behind the head.

Move the drawing into the repo's icon pipeline, so one source produces
`icon.png`, the three adaptive layers, `splash-icon.png`, `favicon.png`
and the docs preview. Update the tests to the new drawing. Set the
adaptive and splash backgrounds to the tile colour.

## Acceptance

- [ ] `app/scripts/app-icon/` holds the drawing as one TypeScript source.
- [ ] `npm run app-icon:build` rebuilds every asset from that source.
- [ ] `icon.png` is 1024 square, opaque and full bleed.
- [ ] The adaptive layers keep their mark inside the 66 of 108 safe circle.
- [ ] `adaptiveIcon.backgroundColor` is the wave tile's background colour.
- [ ] The splash background and image come from the same source.
- [ ] A test fails when a source and `app.json` drift apart.
- [ ] Themed icons show the outlined mark.
- [ ] The local gate passes.
- [ ] The emulator shows the masked icon on the home screen.
- [ ] The emulator shows the splash.
- [ ] The web build shows the favicon.
- [ ] ADR `20261118-app-icon` carries a dated amendment with the rejects.

## Outcome
(filled in before moving to done/)
