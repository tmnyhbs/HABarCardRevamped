# Bar Card Revamped v1.0.0

A custom bar/gauge card for [Home Assistant](https://www.home-assistant.io/) dashboards.

Rebuilt from the ground up for modern Home Assistant (2026+), this card displays entity values as horizontal or vertical progress bars with rich customization options.

## What's New in v4

- **Zero build step** — single `.js` file, no bundler or transpiler needed.
- **Modern standards** — vanilla `HTMLElement` with Shadow DOM; no decorators, no `custom-card-helpers` dependency.
- **Built-in visual editor** — uses Home Assistant's native `getConfigForm()` API; no separate editor element required.
- **Sections view support** — implements `getGridOptions()` for proper sizing in the new sections layout.
- **Card picker registration** — appears in the "Add Card" dialog automatically.
- **Cleaned-up CSS** — uses `ha-card` theming, CSS custom properties, and modern layout (gap, inset, etc.).
- **Full feature parity** — severity colors/icons/hide, animation, target markers, directions, positions, columns/stack, complementary values, entity rows, tap actions.

## Installation

### HACS (recommended)

1. Add this repository as a custom repository in HACS (Frontend category).
2. Install **Bar Card Revamped**.
3. Refresh your browser.

### Manual

1. Copy `bar-card.js` into your `<config>/www/` directory.
2. Add it as a dashboard resource:

```yaml
resources:
  - url: /local/bar-card.js
    type: module
```

3. Refresh your browser.

## Quick Start

```yaml
type: custom:bar-card
entity: sensor.cpu_usage
```

## Configuration

### Card Options

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | **required*** | Single entity to display. |
| `entities` | list | — | List of entities (strings or objects with per-entity overrides). |
| `title` | string | — | Card header title. |
| `name` | string | friendly_name | Custom display name. |
| `icon` | string | auto | Custom icon (e.g. `mdi:thermometer`). |
| `attribute` | string | — | Display a specific attribute instead of state. |
| `unit_of_measurement` | string | auto | Override unit of measurement. |
| `min` | number | `0` | Minimum bar value. |
| `max` | number | `100` | Maximum bar value. |
| `decimal` | number | — | Number of decimal places. |
| `height` | number/string | `40` | Bar height in px. |
| `width` | string | — | Bar width (e.g. `70%`). |
| `color` | string | `var(--primary-color)` | Bar fill color. |
| `direction` | string | `right` | Bar direction: `right`, `up`, `right-reverse`, `up-reverse`. |
| `columns` | number | `1` | Number of bars per row (for multi-entity). |
| `stack` | string | — | Set to `horizontal` to auto-column all entities. |
| `limit_value` | boolean | `false` | Clamp displayed value to min/max. |
| `complementary` | boolean | `false` | Display `max - value` instead of value. |
| `target` | number | — | Show a target marker at this value. |
| `entity_row` | boolean | `false` | Transparent mode for use inside an entities card. |
| `zones` | object | — | Five-zone coloration. See [Zones](#zones). |
| `tap_action` | object | `more-info` | Action on tap (see Actions below). |

*One of `entity` or `entities` is required.

### Positions

Control where each element renders relative to the bar:

```yaml
positions:
  icon: outside       # inside | outside | off
  indicator: outside  # inside | outside | off
  name: inside        # inside | outside | off
  value: inside       # inside | outside | off
  minmax: off         # inside | outside | off
```

### Severity

Change bar color, icon, or visibility based on value ranges:

```yaml
severity:
  - from: 0
    to: 30
    color: green
  - from: 31
    to: 70
    color: orange
  - from: 71
    to: 100
    color: red
    icon: mdi:alert
```

Each severity entry supports: `from`, `to`, `color`, `icon`, `hide`, `text` (for non-numeric states).

### Zones

Five-zone color system inspired by [Zone Tile Card](https://github.com/tmnyhbs/ZoneTileCardForHomeAssistant). The bar color changes across five zones based on four thresholds and three configurable colors. Works for any sensor with an ideal range — temperature, humidity, shot times, CO₂, soil moisture, etc.

| Zone | Color | Condition |
|---|---|---|
| Danger (low) | `color_danger` (`#E24B4A`) | Below `min_danger` |
| Warning (low) | `color_warning` (`#EF9F27`) | Between `min_danger` and `min_warning` |
| OK | `color_ok` (`#5DCAA5`) | Between `min_warning` and `max_warning` |
| Warning (high) | `color_warning` (`#EF9F27`) | Between `max_warning` and `max_danger` |
| Danger (high) | `color_danger` (`#E24B4A`) | Above `max_danger` |

```yaml
# Temperature example
zones:
  min_danger: 55
  min_warning: 62
  max_warning: 78
  max_danger: 85

# Espresso shot time example
zones:
  min_danger: 20
  min_warning: 27
  max_warning: 32
  max_danger: 35
  color_danger: "#E24B4A"
  color_warning: "#EF9F27"
  color_ok: "#5DCAA5"
```

Zones can be set at the card level (applies to all entities) or per-entity for individual overrides. All zone options are configurable from the visual editor — card-level under Appearance → Zone Colors, per-entity via the tune icon (⚙) on each entity row. If both severity and zones are defined, zones take priority.

### Animation

```yaml
animation:
  state: "on"   # on | off
  speed: 5       # seconds per animation cycle
```

### Actions

```yaml
tap_action:
  action: more-info    # more-info | toggle | call-service | navigate | url | none
  # For call-service:
  service: light.turn_on
  service_data:
    entity_id: light.living_room
  # For navigate:
  navigation_path: /lovelace/room
  # For url:
  url_path: https://example.com
```

### Theme Variables

| Variable | Description |
|---|---|
| `--bar-card-color` | Default bar color. |
| `--bar-card-border-radius` | Bar corner radius (falls back to `--ha-card-border-radius`). |
| `--bar-card-disabled-color` | Bar color when entity is unavailable. |

## Examples

### Multiple Entities with Severity

```yaml
type: custom:bar-card
title: System Monitor
columns: 1
entities:
  - entity: sensor.cpu_usage
    name: CPU
    severity:
      - { from: 0, to: 60, color: green }
      - { from: 61, to: 85, color: orange }
      - { from: 86, to: 100, color: red }
  - entity: sensor.memory_usage
    name: RAM
  - entity: sensor.disk_usage
    name: Disk
```

### Vertical Bars (Stacked Horizontally)

```yaml
type: custom:bar-card
title: Temperatures
direction: up
height: 200
stack: horizontal
entities:
  - sensor.living_room_temp
  - sensor.bedroom_temp
  - sensor.kitchen_temp
```

### Entity Row Mode

```yaml
type: entities
title: Sensors
entities:
  - sensor.humidity
  - type: custom:bar-card
    entity: sensor.battery_level
    entity_row: true
    positions:
      icon: inside
      name: inside
      value: inside
```

### Outside Name Layout

```yaml
type: custom:bar-card
entity: sensor.battery_level
positions:
  icon: "off"
  indicator: inside
  name: outside
width: 70%
```

## Credits

Rebuilt from the original [bar-card](https://github.com/custom-cards/bar-card) by [tmnyhbs](https://github.com/tmnyhbs).

## License

MIT
