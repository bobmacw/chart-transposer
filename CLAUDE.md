# Chart Transposer: house rules

Live at https://bobmacw.github.io/chart-transposer/ (GitHub Pages, deployed from `main`).
Used by Bob's band at rehearsal, so the live site must always work.

## Workflow: verification before anything goes live

- Never commit or push to `main`. `main` is protected; every change goes through a pull request.
- Work on a branch named for the change (e.g. `fix-tab-alignment`, `add-text-size`).
- Before opening the pull request, run the regression checks and add a new check for any bug being fixed.
- Publish a preview of the changed page (e.g. a claude.ai artifact) so Bob can try it with a real chart before merging.
- The pull request description says, in plain words: what changed, why, how it was tested, and the preview link.
- Bob merges. Merging is the approval. Never merge on his behalf.

## Code conventions

- One self-contained `index.html`: HTML, CSS and vanilla JavaScript inline. No frameworks, no build step, no external scripts.
- Only external resource allowed: the Google Fonts stylesheet (the page must still work without it).
- Always output the complete file.
- Keep a semver version in an HTML comment at the top of `index.html`; bump it with each change (patch for fixes, minor for features).
- Nothing the user pastes may leave their browser: no network requests, no analytics.
- Escape pasted text before inserting it into the page.

## Transposing rules

- Only chord lines and `[bracketed]` chords change. Lyric text and spacing are never altered.
- A line is a chord line when every token is a chord or a known marker (`|`, `x2`, `N.C.`, `%`, etc.).
- Expand tabs to 8-column stops before transposing, so chord and lyric lines stay aligned.
- Keep each chord at its original column; if a longer chord would collide, add one space.
- Slash chords: transpose the chord and the bass note separately (`C/E` → `G/B`).
- Spelling: notes in the target key use that key's accidentals; borrowed chords keep the original's sharp/flat direction (`Fm/Ab` in C → `Cm/Eb` in G).

## Regression checks (C → G unless noted)

Automated in `tests/regression.mjs`, run by GitHub Actions (`.github/workflows/checks.yml`) on every pull request. Run locally with `npm install --no-save jsdom@26 && node tests/regression.mjs`. A pull request is not ready until the check is green. When fixing a bug, add a check that would have caught it.


- `C/E` → `G/B`, `D/F#` → `A/C#`, `Am7/G` → `Em7/D`, `Fm/Ab` → `Cm/Eb`, `Bb` → `F`, `Cmaj7/E` → `Gmaj7/B`
- C → F: `D/F#` → `G/B`, `Ab` → `Db`, `E7` → `A7`
- A lyric line starting "Am I the one" is unchanged.
- A chart using tabs between chords keeps each chord over the same word.
- `[C]Words [Am]here` → `[G]Words [Em]here`
