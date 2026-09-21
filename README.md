# Manga Reader

A two-page (**spread**) view for Stash's image lightbox, for reading manga the way
it was printed: two pages side by side, the earlier one on the right.

**Status: working, and off until you turn it on.** Open any gallery, open an image,
open the lightbox's options menu — the one behind the gear icon in its header — and
there is a **Double page** switch at the bottom with the rest of the options.

## What it does

While the switch is on, and while you are reading a **gallery**:

| | |
|---|---|
| **Two pages at once** | Laid out to fit the screen, in reading order, the earlier page on the right |
| **Spreads** | A page wider than it is tall is taken for one image spanning two pages, and stands alone |
| **The cover** | Stands alone. A cover is not the left half of anything |
| **Arrows and chevrons** | Left and right move a *screen*, not a page — so a pair advances together. The keyboard arrows and Stash's own chevrons both go through the same turn |
| **Clicks** | Clicking a page turns it, right half forward and left half back, exactly as Stash's own image click does. Clicking the space around the pages still closes the lightbox |
| **Shift the pairing** | A second switch in the options menu, or `O`, for a gallery whose pages are grouped wrongly. Remembered for that gallery |
| **The change of screen** | Fades in rather than snapping — briefly, and never at the cost of a wait. A slider in the options menu sets how long, down to 0 for none. Nothing is animated for a reader who has asked their system for less motion |
| **Everything else** | Untouched. The header counter, the chapters, the nav strip, Escape, fullscreen, the slideshow — all still Stash's, and all still work, because the lightbox is still what says which page you are on |

All of it is remembered per browser, like the lightbox options the controls sit
beside — except the shift, which is remembered *per gallery*, because that is what
it belongs to: one scan's pages need shifting and the gallery next to it does not.

The fade length is a **slider rather than a number box**, with the value shown beside
it, and its range reaches 1000 ms on purpose: a reader who cannot see a short fade
has to be able to push it somewhere unmistakable and find out whether it is doing
anything at all. 0 is a setting too — the screen is drawn at once.

Off a gallery page — an image list, a scene's stills — the mode draws nothing, even
switched on: pairing pages only means something inside a gallery.

## The three things worth knowing

**It is DOM surgery, not a React patch.** Stash's lightbox is
`LightboxComponent`, a plain `React.FC` with no `PatchComponent` wrapper, so
`PluginApi.patch` cannot reach it. What this plugin does instead is watch the
document for a lightbox appearing, put a container of its own **beside** Stash's
carousel — never in place of it, so React can re-render its own subtree without
ours going with it — hide that carousel with a class, and drive the lightbox
through its own interface: it reads where the lightbox is from its header, and
moves it with its own arrow keys rather than keeping a second idea of the current
page that could drift from the first.

The approach follows
[kokkengMangaViewer](https://github.com/kokkeng1/stash_plugin_custom/tree/main/plugins/kokkengMangaViewer),
which does the same thing in the wild for a scrolling view.

**Keys are pressed one at a time, and that is not a detail.** A turn of a screen is
two pages, and the lightbox moves one page per press — but it *drops* a press that
arrives while the page before it is still swapping (`isSwitchingPageRef` in Stash's
lightbox: "rapid inputs are dropped"). Two presses in the same tick therefore move
one page rather than two, intermittently, since a cached page swaps fast enough for
it not to happen. So a move is an errand: press once, wait for the header to say it
landed, press again — and send it again if the wait runs out, because a dropped
press changes nothing in the DOM for anything else to notice.

**Everything it depends on is in one file.** `src/stash-lightbox.ts` holds the
class names, the header format and the image query — the whole of what this plugin
assumes about Stash's markup. If a Stash release renames any of it, the reader stops
drawing and says so in the console rather than drawing something wrong: a canvas
that cannot tell where it is must not paint. The same goes for a gallery Stash
cannot answer for, or one whose page count no longer matches what the lightbox is
showing.

**Stash's own ways of turning a page go through this plugin's turn.** There are
three of them and none of them can be left alone once the pages are paired:

- the **keyboard arrows**, taken in the capture phase on the window, in front of
  Stash's own handler;
- the **chevrons** either side of the image, which are Stash's buttons and move one
  page — in a two-page view the same screen, so a reader clicking one sees nothing
  happen. The click is stopped before Stash's React handler sees it and the same
  errand an arrow press starts is started instead;
- the **click on a page**, which Stash reads per image (the right half forward, the
  left half back) and this plugin reads the same way.

Every one of them ends in `turnBy`, so the three cannot disagree about what a turn
is. The exception is the click *around* the pages: Stash closes the lightbox when a
click reaches the slide its images sit in, and this plugin's container covers that
slide — so a click there is turned back into what Stash would have done with it, an
`Escape`, which is Stash's own closing path and not a second idea of closing.

**A screen goes up whole, and both of its images are asked for the way Stash asks
for them.** Those are two halves of one problem: two pages that arrive separately
read as a flicker rather than as a page, and the reason they arrived separately was
mostly self-inflicted.

Stash publishes each image's URL with a **version stamp** on it —
`/image/<id>/image?t=<mtime>` — and its own lightbox uses that URL. The plugin
used to build `/image/<id>/image` by hand, without the stamp, and the two are
**different browser cache entries**:

| URL | what the server answers with |
|---|---|
| `/image/<id>/image?t=<mtime>` | `private, max-age=31536000, immutable` |
| `/image/<id>/image` | `no-cache` |

So the hand-built URL did not merely miss a version: it threw away the caching
Stash's own lightbox had already paid for, and every page was fetched twice — once
by Stash's carousel, once by the reader — with nothing making the two halves of a
screen finish together. The fix is one field in the query (`paths { image }`), whose
query is lifted onto the reader's own relative path: same resource, same cache
entry, and now the pages Stash has already loaded are there the moment they are
asked for.

What remains is genuinely cold: the first screen, a jump, a slow disk. For those,
the screen is built **detached** and shown in one step — the reader keeps whatever
is already on screen until both images can be painted (the browser is asked with
`decode()`, not guessed at) — and a **budget of 300 ms** caps the wait, so a page
that never arrives cannot leave the reader looking at one they have already turned.
A turn that overtakes a screen still waiting takes its place: a counter decides
which draw owns the container, so the older one cannot land on top of it.

That one step is then **faded in**, over about 140 ms: a pair of pages filling the
display is a large area to change between two frames, and at a turn that reads as a
flash. The fade is against the lightbox's own background rather than over the page
before it — a cross-fade is smoother on a photograph and worse on everything else,
since two pages of text superimposed are illegible soup for as long as it lasts. It
starts only once the images are there, so it is never a wait in disguise, and it
does not happen at all for a reader whose system asks for less motion.

## What is not here yet

- **No zoom or pan in spread mode.** Stash's zoom acts on the carousel, which is
  hidden while this plugin draws. Pages are fitted to the screen and that is all.
- **Two of the pairing rules are settings without a UI**: `coverAlone` and
  `detectSpreads` are stored and honoured, but the options menu offers only the
  mode and the shift. Both default to what a manga wants.
- **The switches are worded in English the first time.** Their language comes from
  Stash's own configuration, which is read with the gallery — so the wording is
  right from the second time the menu is opened in a session.
- **Reading progress** is not tracked. That needs a viewer of our own rather than a
  takeover of Stash's.

## Why a separate plugin from mangaTools

`mangaTools` is about *managing* a manga library: the custom fields, the filters,
the panels. This is about *reading* one. They share a purpose and no code, and
reading is where a mistake is most annoying — so they keep separate blast radii.
Nothing here reads `mangaTools`' fields, and nothing there knows this plugin exists.

## Files

```
mangaReader/
├── src/
│   ├── mangaReader.tsx     Entry: loads Stash's API and starts watching
│   ├── spreads.ts          The pairing rules (pure, no DOM)
│   ├── settings.ts         What is remembered, and how it is parsed
│   ├── stash-lightbox.ts   Everything that assumes something about Stash's markup
│   ├── takeover.ts         The reader itself: the observer, the drawing, the keys
│   ├── i18n.ts             The plugin's own two strings
│   └── plugin-api.ts       Types, and the namespace the tests reach
├── tests/
│   ├── smoke.js            The pairing rules and the reader, section by section
│   └── dom.js              A fake DOM: only the parts this plugin touches
├── mangaReader.css         Hiding the carousel, laying out the two pages
├── mangaReader.yml         Plugin config (the file name is the plugin ID)
├── build.mjs               Bundles src/ into dist/, the one file Stash loads
├── tsconfig.json           Compiler options, inlined (nothing is shared)
├── biome.jsonc             Lint and format rules — Stash's own, in full
└── dist/                   Bundled output — generated, gitignored, and the
                            only thing that gets packaged
```

`ui.javascript` names **one** file: `dist/mangaReader.js`, loaded by Stash through
a plain `<script>` tag. `tsc` plays no part in producing it — it only type-checks,
and esbuild strips types without reading them — which is why `pnpm test` runs both.

## Installation

Install through Stash's plugin manager; no copying files by hand.

**Settings → Plugins → Available Plugins → Add Source**

| Field | Value |
|---|---|
| Name | anything |
| Source URL | `https://ravenddddd.github.io/stash-plugin-repo/index.yml` |
| Local Path | anything, e.g. `stash-plugin-repo` |

Then tick Manga Reader → **Install** → **Reload Plugins**.

To update later: **Installed Plugins → Update**.

> To install manually instead: copy the whole `mangaReader/` directory into
> `<Stash config dir>/plugins/` and hit Reload Plugins. Note the js/css paths in
> the `.yml` are relative to the `.yml`, so the directory has to stay complete —
> copying the `.yml` alone is not enough.

## Verifying

From the repository root (no Stash required):

```bash
pnpm install        # once
pnpm lint           # biome lint
pnpm format         # biome format --write, when the check below complains
pnpm typecheck      # tsc over the sources
pnpm build          # bundle into dist/ (no type-check)
pnpm test           # lint, format check, type-check, build, then the tests
```

What the tests cannot cover is whether Stash's markup is still what
`stash-lightbox.ts` says it is. No test of ours can, which is why the reader is
written to stop rather than guess — the failure mode is a switch that has to be
pressed again, never a blank screen.
