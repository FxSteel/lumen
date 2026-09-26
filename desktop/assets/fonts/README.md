# NOVA Display — packaged fonts (NDI renderer)

The NDI output manager (`desktop/src/main/ndiManager.ts`) renders lyric/verse
frames with **node-canvas**. For those frames to match the web renderer
(fidelity), the exact fonts NOVA supports must be registered with node-canvas
via `registerFont(path, { family, weight })`, and the renderer must expose the
same faces through `@font-face`.

**Drop the font files listed below into this directory** (`desktop/assets/fonts/`).
Filenames must match **exactly** — `registerPackagedFonts()` looks them up by
name. Missing files are skipped with a warning (the frame falls back to the
system `sans-serif`), so the pipeline never crashes; it just loses fidelity
until the real binaries are present.

> These are real font binaries and are **not** committed here — they must be
> added by whoever prepares the build (see TODO at the bottom).

## Supported families → weights → filenames

Families are the ones `resolveTypography()` emits (`SUPPORTED_FONTS` in
`@nova/shared`: Inter, Poppins, Montserrat, Roboto Flex, Open Sans). Weights
used by NOVA slides: **400 Regular · 500 Medium · 600 SemiBold · 700 Bold**.

| Family        | Weight | Filename (required)        |
|---------------|--------|----------------------------|
| `Inter`       | 400    | `Inter-Regular.ttf`        |
| `Inter`       | 500    | `Inter-Medium.ttf`         |
| `Inter`       | 600    | `Inter-SemiBold.ttf`       |
| `Inter`       | 700    | `Inter-Bold.ttf`           |
| `Poppins`     | 400    | `Poppins-Regular.ttf`      |
| `Poppins`     | 500    | `Poppins-Medium.ttf`       |
| `Poppins`     | 600    | `Poppins-SemiBold.ttf`     |
| `Poppins`     | 700    | `Poppins-Bold.ttf`         |
| `Montserrat`  | 400    | `Montserrat-Regular.ttf`   |
| `Montserrat`  | 500    | `Montserrat-Medium.ttf`    |
| `Montserrat`  | 600    | `Montserrat-SemiBold.ttf`  |
| `Montserrat`  | 700    | `Montserrat-Bold.ttf`      |
| `Roboto Flex` | 400    | `RobotoFlex-Regular.ttf`   |
| `Roboto Flex` | 500    | `RobotoFlex-Medium.ttf`    |
| `Roboto Flex` | 600    | `RobotoFlex-SemiBold.ttf`  |
| `Roboto Flex` | 700    | `RobotoFlex-Bold.ttf`      |
| `Open Sans`   | 400    | `OpenSans-Regular.ttf`     |
| `Open Sans`   | 500    | `OpenSans-Medium.ttf`      |
| `Open Sans`   | 600    | `OpenSans-SemiBold.ttf`    |
| `Open Sans`   | 700    | `OpenSans-Bold.ttf`        |

**20 files total** (5 families × 4 weights).

### Note on Roboto Flex

Google ships Roboto Flex as a single **variable** font
(`RobotoFlex[...variable axes...].ttf`). node-canvas static weight matching is
most reliable with per-weight static instances, so export static TTFs at
400/500/600/700 and name them as in the table above. The logical family name
registered with node-canvas and used in CSS remains **`Roboto Flex`**.

## Where these files load from at runtime

`fontsDir()` in `ndiManager.ts` resolves this folder the same way the tray icon
is resolved:

- **dev:** `<repo>/desktop/assets/fonts/` (via `app.getAppPath()`)
- **packaged:** `<resourcesPath>/assets/fonts/`

## TODO (build/packaging)

1. **Add the 20 real `.ttf` binaries** to this directory (licensing: all five
   families are OFL/Apache — redistributable with the app).
2. **Include this folder in packaged builds.** `desktop/electron-builder.json`
   currently copies only `assets/nova.png` via `extraResources`. Add:
   ```json
   { "from": "assets/fonts", "to": "assets/fonts" }
   ```
   (out of scope for this lane — electron-builder.json is not edited here.)
3. Ensure the renderer's `@font-face` declarations use the identical family
   names and weights so web and NDI output stay in sync.
