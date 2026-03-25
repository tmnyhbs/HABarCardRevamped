# Bar Card

A customizable bar/gauge card for Home Assistant dashboards. Display entity values as horizontal or vertical progress bars with severity colors, animations, target markers, and more.

## Features

- **Horizontal & vertical bars** with configurable direction and reverse modes.
- **Severity system** — change bar color, icon, or hide bars based on value ranges.
- **Animations** — visual pulse effects when values increase or decrease.
- **Target markers** — show a goal/target line on the bar.
- **Multi-entity** — display multiple entities in rows or columns.
- **Visual editor** — full GUI editor with entity add/remove/reorder and per-entity overrides.
- **Sections view** — proper grid sizing via `getGridOptions()`.
- **Zero dependencies** — single JS file, no build step required.

## Quick Start

```yaml
type: custom:bar-card
entity: sensor.cpu_usage
```

## Multi-Entity with Severity

```yaml
type: custom:bar-card
title: System Monitor
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

See the [README](https://github.com/custom-cards/bar-card) for full documentation.
