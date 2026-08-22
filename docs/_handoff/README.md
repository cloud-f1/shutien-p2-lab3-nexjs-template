# docs/_handoff/ — design-handoff bundle convention

This is where a **design handoff** lands when a mockup, PRD, or domain-knowledge document
arrives from outside the epic pipeline — a Claude Design export, a Figma export, an
outsourced HTML prototype, or a client-supplied requirements/domain doc.

This is a **new convention this epic introduces**, not something already wired into any
skill. `mockup-to-epics` and `alignment-audit` both describe their inputs generically — "a
design bundle", "the mockup/PRD/domain doc + screenshots" — without naming a fixed path.
This folder gives that generic bundle a canonical home, so both skills (and a human running
them) have one predictable place to look instead of re-deciding it per project.

## Folder layout

```
docs/_handoff/
  README.md          this file
  project/            drop the design bundle here — PRD, domain-knowledge doc, HTML/CSS/JS
                       prototypes, exported assets. .gitkeep only until something lands.
  screenshots/        per-page/per-screen screenshots captured FROM the design bundle (or
                       later from the built app, for before/after comparison). .gitkeep
                       only until something lands.
```

## Who puts what here

- **Whoever receives the handoff** (a human running `/athena:plan mockup <path>`, or an
  agent told "here's a design bundle") copies the design source into `project/` and any
  screenshots the design tool exported (or that get captured while reading the bundle) into
  `screenshots/`.
- Don't restructure this folder per-project — `project/` and `screenshots/` are the two
  fixed subfolders every bundle uses, no matter how the upstream tool organized its own
  export.
- **Note on layout vs. `mockup-to-epics`'s own example:** that skill's step 2 shows
  screenshots nested *inside* the bundle (`project/screenshots/`, its own generic example
  path). Within `docs/_handoff/` specifically, keep `screenshots/` as a **top-level sibling**
  of `project/` instead — it keeps "the bundle exactly as received" (`project/`) separate
  from "images captured while working it" (`screenshots/`), and matches the layout this
  README documents above. If you're following that skill's inline example elsewhere and it
  says to nest screenshots under `project/`, that's fine for its generic case — just don't
  carry that nesting into this specific folder.

## What this folder is for (not yet wired into either skill)

- **`mockup-to-epics`** (`/athena:plan mockup <path>`) is where you'd point the primary
  HTML/PRD/domain doc for a mockup-to-epics run — read `project/` for the bundle and treat
  anything already in `screenshots/` as ground truth the skill's own screenshot step can
  extend, per the skill's step 2 ("Run it and 'play' it").
- **`alignment-audit`** (`/athena:align`) is where you'd point it for the **expected
  surface** (the design SSOT) it diffs the built app against — its own Inputs section names
  "the mockup/PRD/domain doc + screenshots" generically; `project/` + `screenshots/` here is
  a concrete instance of that, not something the skill file currently names by path.
- Treat both as **conventions to follow when invoking those skills**, not behavior the
  skills already implement — neither skill's text currently mentions `docs/_handoff` by
  path.

## What belongs in version control

| Goes in git | Doesn't go in git |
|---|---|
| The design bundle's PRD / domain-knowledge doc (markdown/HTML/text) | Large binary design-tool source files (`.sketch`, `.fig`, `.psd`, video walkthroughs) — link out to the design tool instead |
| HTML/CSS/JS prototype source (small, text-based) | Anything containing real customer data, credentials, or API keys accidentally exported with the bundle |
| Screenshots captured for epic/audit reference (`screenshots/*.png`) | Auto-generated build artifacts from the design tool that aren't needed to re-derive the epics |

**Gotcha:** the repo's root `.gitignore` ignores `*.png` globally (screenshot-diff and
test-artifact hygiene). This folder's `screenshots/*.png` files are explicitly negated
(`!docs/_handoff/screenshots/*.png`) so design-handoff screenshots ARE tracked — the same
pattern `docs/assets/` already used. If you add a new screenshot subfolder here, extend the
negation or your screenshots will silently not commit.

## Empty today, by design

The template ships this folder empty (just the two `.gitkeep` files) because it has no
design handoff of its own — a fork's first real handoff is the first thing that lands here.
