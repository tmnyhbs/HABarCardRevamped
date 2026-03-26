# Changelog

## [1.0.0] - 2026-03-25

### Complete Rebuild

Bar Card Revamped has been rebuilt from the ground up for modern Home Assistant (2026+).

### Changed

- **Zero build step** — single vanilla JS file, no bundler, transpiler, or external dependencies.
- **Custom visual editor** — full `getConfigElement()` editor with multi-entity support: add, remove, reorder entities, expand per-entity overrides (name, icon, attribute, unit, color, min, max, target).
- **Zone coloration** — five-zone color system (cold/cool/comfort/warm/hot) with 4 thresholds and 3 configurable colors. Same logic as [Zone Tile Card](https://github.com/tmnyhbs/ZoneTileCardForHomeAssistant), with color pickers in the visual editor.
- **Sections view support** — implements `getGridOptions()` for proper sizing in the sections layout.
- **Card picker registration** — appears in the "Add Card" dialog via `window.customCards`.
- **Shadow DOM** — proper encapsulation replaces the old inline `<style>` tag approach.
- **Modern CSS** — uses `inset`, `gap`, CSS custom properties, and native `ha-card` theming.
- **Content-based sizing** — `ha-card` sizes to content instead of forcing `height: 100%`; title headers no longer overflow into neighboring cards.

### Removed

- `lit-element` and `custom-card-helpers` dependencies (no longer needed).
- Rollup/TypeScript build pipeline (no longer needed).
- `entity_config` option (was rarely used and added complexity).
- `left`, `down`, `left-reverse`, `down-reverse` directions (were broken/unsupported in v3).

### Retained (full feature parity)

- Severity system (color, icon, hide, text matching).
- Animation (increase/decrease pulses with configurable speed).
- Target markers.
- Directions: `right`, `up`, `right-reverse`, `up-reverse`.
- All 5 position slots: icon, indicator, name, value, minmax — each with inside/outside/off.
- Multi-entity with columns and horizontal stack.
- Complementary values.
- Entity row mode (transparent, for use inside entities cards).
- Tap actions: more-info, toggle, call-service, navigate, url.
- Theme variables: `--bar-card-color`, `--bar-card-border-radius`, `--bar-card-disabled-color`.

---

## [3.2.0] and earlier

See the [original bar-card repository](https://github.com/custom-cards/bar-card) for v3.x history.
