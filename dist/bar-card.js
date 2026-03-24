/**
 * Bar Card v4.0.0
 * A custom bar/gauge card for Home Assistant dashboards.
 *
 * Rebuilt from the ground up using modern Home Assistant standards (2026):
 *   - Vanilla LitElement (no build step, no decorators)
 *   - Built-in getConfigForm() visual editor
 *   - getGridOptions() for sections view
 *   - Proper ha-card theming via CSS custom properties
 *   - Registered in window.customCards for the card picker
 *
 * Original concept by custom-cards/bar-card (v3.x).
 */

const CARD_VERSION = "4.0.0";

console.info(
  `%c  BAR-CARD %c v${CARD_VERSION} `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepMerge(target, ...sources) {
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  for (const src of sources) {
    if (!isObj(src)) continue;
    for (const key of Object.keys(src)) {
      if (isObj(target[key]) && isObj(src[key])) {
        target[key] = deepMerge({}, target[key], src[key]);
      } else {
        target[key] = src[key];
      }
    }
  }
  return target;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function percent(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function domainIcon(entityId, state) {
  // Minimal fallback icon resolver based on domain
  const domain = entityId ? entityId.split(".")[0] : "";
  const icons = {
    sensor: "mdi:eye",
    binary_sensor: "mdi:checkbox-blank-circle",
    light: "mdi:lightbulb",
    switch: "mdi:toggle-switch",
    fan: "mdi:fan",
    climate: "mdi:thermostat",
    cover: "mdi:window-shutter",
    media_player: "mdi:cast",
    input_number: "mdi:ray-vertex",
    number: "mdi:ray-vertex",
    humidifier: "mdi:air-humidifier",
    vacuum: "mdi:robot-vacuum",
    person: "mdi:account",
    weather: "mdi:weather-partly-cloudy",
    water_heater: "mdi:water-boiler",
  };
  return icons[domain] || "mdi:bookmark";
}

// Expand the top-level config + entities list into a flat per-entity array,
// each entity inheriting defaults from the card-level config.
function buildConfigArray(config) {
  const base = { ...config };
  delete base.entities;
  const arr = [];
  if (config.entities && config.entities.length) {
    for (const ent of config.entities) {
      if (typeof ent === "string") {
        arr.push(deepMerge({}, base, { entity: ent }));
      } else {
        arr.push(deepMerge({}, base, ent));
      }
    }
  } else if (config.entity) {
    arr.push(deepMerge({}, base));
  }
  return arr;
}

// ─── Main Card Element ───────────────────────────────────────────────────────

class BarCard extends HTMLElement {
  // --- HA lifecycle ----------------------------------------------------------

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    if (!config.entity && (!config.entities || !config.entities.length)) {
      throw new Error("bar-card: You must define 'entity' or 'entities'.");
    }

    this._config = deepMerge(
      {
        animation: { state: "off", speed: 5 },
        color: "var(--bar-card-color, var(--primary-color))",
        columns: 1,
        direction: "right",
        max: 100,
        min: 0,
        decimal: null,
        height: 40,
        limit_value: false,
        complementary: false,
        positions: {
          icon: "outside",
          indicator: "outside",
          name: "inside",
          minmax: "off",
          value: "inside",
        },
        tap_action: { action: "more-info" },
      },
      config
    );

    if (this._config.stack === "horizontal") {
      this._config.columns = (this._config.entities || [this._config.entity]).length;
    }

    this._configArray = buildConfigArray(this._config);
    this._prevStates = this._prevStates || {};
    this._indicators = this._indicators || {};

    // Build shadow DOM once
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    // Force re-render on config change
    if (this._hass) this._render();
  }

  // --- Sizing ----------------------------------------------------------------

  getCardSize() {
    const h = typeof this._config.height === "number" ? this._config.height : parseInt(this._config.height) || 40;
    const rows = Math.ceil(this._configArray.length / (this._config.columns || 1));
    return Math.max(1, Math.round((h * rows) / 50) + 1);
  }

  getGridOptions() {
    return {
      rows: Math.max(1, Math.ceil(this._configArray.length / (this._config.columns || 1))),
      columns: 12,
      min_rows: 1,
      min_columns: 3,
    };
  }

  // --- Visual editor (built-in form) -----------------------------------------

  static getConfigForm() {
    return {
      schema: [
        { name: "label", selector: { label: {} } },
        {
          name: "entity",
          required: true,
          selector: { entity: {} },
        },
        {
          type: "grid",
          name: "",
          flatten: true,
          schema: [
            { name: "name", selector: { text: {} } },
            {
              name: "icon",
              selector: { icon: {} },
              context: { icon_entity: "entity" },
            },
            {
              name: "attribute",
              selector: { attribute: {} },
              context: { filter_entity: "entity" },
            },
            { name: "unit_of_measurement", selector: { text: {} } },
          ],
        },
        {
          type: "expandable",
          name: "",
          title: "Bar Appearance",
          flatten: true,
          schema: [
            {
              type: "grid",
              name: "",
              flatten: true,
              schema: [
                { name: "min", selector: { number: { mode: "box" } } },
                { name: "max", selector: { number: { mode: "box" } } },
                { name: "height", selector: { number: { min: 10, max: 500, unit_of_measurement: "px", mode: "box" } } },
                { name: "decimal", selector: { number: { min: 0, max: 6, mode: "box" } } },
                { name: "color", selector: { text: {} } },
                {
                  name: "direction",
                  selector: {
                    select: {
                      options: [
                        { value: "right", label: "Right" },
                        { value: "up", label: "Up" },
                        { value: "right-reverse", label: "Right (reverse)" },
                        { value: "up-reverse", label: "Up (reverse)" },
                      ],
                    },
                  },
                },
              ],
            },
            { name: "limit_value", selector: { boolean: {} } },
            { name: "complementary", selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (s) => {
        const labels = {
          entity: "Entity",
          name: "Name",
          icon: "Icon",
          attribute: "Attribute",
          unit_of_measurement: "Unit",
          min: "Min Value",
          max: "Max Value",
          height: "Bar Height",
          decimal: "Decimal Places",
          color: "Bar Color",
          direction: "Direction",
          limit_value: "Clamp Value to Min/Max",
          complementary: "Show Complementary Value",
        };
        return labels[s.name] ?? undefined;
      },
    };
  }

  static getConfigElement() {
    // Let HA use the built-in form editor via getConfigForm
    return undefined;
  }

  static getStubConfig() {
    return {
      entity: "sensor.example",
      min: 0,
      max: 100,
    };
  }

  // --- Rendering -------------------------------------------------------------

  _render() {
    if (!this._hass || !this._config) return;

    const root = this.shadowRoot;
    root.innerHTML = "";

    // Styles
    const style = document.createElement("style");
    style.textContent = BarCard._styles();
    root.appendChild(style);

    // ha-card wrapper
    const card = document.createElement("ha-card");
    if (this._config.title) card.setAttribute("header", this._config.title);
    if (this._config.entity_row) card.classList.add("entity-row-mode");

    const content = document.createElement("div");
    content.className = "card-content";
    if (this._config.direction === "up") content.classList.add("grow");

    const columns = this._config.columns || 1;

    // Build rows
    const rows = [];
    for (let i = 0; i < this._configArray.length; i += columns) {
      const rowEl = document.createElement("div");
      rowEl.className = "bar-row";
      if (columns > 1) rowEl.classList.add("multi-col");

      for (let c = 0; c < columns && i + c < this._configArray.length; c++) {
        const idx = i + c;
        const cfg = this._configArray[idx];
        const barEl = this._createBar(cfg, idx);
        if (barEl) rowEl.appendChild(barEl);
      }
      content.appendChild(rowEl);
    }

    card.appendChild(content);
    root.appendChild(card);
  }

  _createBar(config, index) {
    const hass = this._hass;
    const stateObj = hass.states[config.entity];

    if (!stateObj) {
      const warn = document.createElement("div");
      warn.className = "warning";
      warn.textContent = `Entity not available: ${config.entity}`;
      return warn;
    }

    // Resolve value
    let rawValue = config.attribute ? stateObj.attributes[config.attribute] : stateObj.state;
    const isNumeric = !isNaN(Number(rawValue)) && rawValue !== "" && rawValue !== null;
    let numericValue = isNumeric ? Number(rawValue) : null;

    // Severity hide check
    if (config.severity && this._checkSeverityHide(rawValue, numericValue, config.severity)) {
      return null;
    }

    // Limit / clamp
    if (config.limit_value && numericValue !== null) {
      numericValue = clamp(numericValue, config.min, config.max);
    }

    // Format display value
    let displayValue;
    if (numericValue !== null) {
      if (config.complementary) numericValue = config.max - numericValue;
      displayValue =
        config.decimal != null ? numericValue.toFixed(config.decimal) : String(numericValue);
    } else {
      displayValue = String(rawValue);
    }

    // Compute bar percent (always from unclamped non-complementary value)
    let barSourceValue = config.attribute
      ? Number(stateObj.attributes[config.attribute])
      : Number(stateObj.state);
    if (isNaN(barSourceValue)) barSourceValue = null;
    if (config.limit_value && barSourceValue !== null) barSourceValue = clamp(barSourceValue, config.min, config.max);

    let barPct = 0;
    if (rawValue === "unavailable" || rawValue === "unknown") {
      barPct = 0;
    } else if (barSourceValue !== null) {
      barPct = percent(barSourceValue, config.min, config.max);
    } else {
      barPct = 100;
    }

    // Reverse directions
    if (config.direction && config.direction.endsWith("-reverse")) {
      barPct = 100 - barPct;
    }

    barPct = clamp(barPct, 0, 100);

    // Determine bar color (severity or config)
    let barColor = config.color;
    if (config.severity) {
      barColor = this._severityColor(rawValue, numericValue, config.severity) || barColor;
    }
    if (rawValue === "unavailable") {
      barColor = `var(--bar-card-disabled-color, var(--disabled-color, ${config.color}))`;
    }

    // Indicator
    const prevKey = `${config.entity}_${config.attribute || ""}`;
    const prevVal = this._prevStates[prevKey];
    let indicator = this._indicators[prevKey] || "";
    if (isNumeric && prevVal !== undefined) {
      if (Number(rawValue) > prevVal) indicator = "▲";
      else if (Number(rawValue) < prevVal) indicator = "▼";
    }
    if (isNumeric) this._prevStates[prevKey] = Number(rawValue);
    this._indicators[prevKey] = indicator;

    // Icon
    let icon = null;
    if (config.severity) icon = this._severityIcon(rawValue, numericValue, config.severity);
    if (!icon) icon = config.icon || stateObj.attributes.icon || domainIcon(config.entity, rawValue);

    // Name
    const name = config.name || stateObj.attributes.friendly_name || config.entity;

    // Unit
    let unit = "";
    if (isNumeric) {
      unit = config.unit_of_measurement ?? stateObj.attributes.unit_of_measurement ?? "";
    }

    // Direction flags
    const isVertical = config.direction === "up" || config.direction === "up-reverse";
    const barDirection = isVertical ? "top" : "right";

    // Build height
    let heightStr = typeof config.height === "number" ? `${config.height}px` : config.height;

    // --- DOM construction ---
    const wrapper = document.createElement("div");
    wrapper.className = `bar-wrapper ${isVertical ? "vertical" : "horizontal"}`;
    wrapper.addEventListener("click", () => this._handleTap(config));

    const positions = config.positions || {};

    // Icon outside
    if (positions.icon === "outside") {
      wrapper.appendChild(this._iconEl(icon));
    }

    // Indicator outside
    if (positions.indicator === "outside" && !isVertical) {
      wrapper.appendChild(this._indicatorEl(indicator, barColor, "outside-right"));
    }

    // Name outside
    if (positions.name === "outside") {
      const nameEl = document.createElement("span");
      nameEl.className = "bar-name outside";
      nameEl.textContent = name;
      if (!isVertical && config.width) nameEl.style.width = `calc(100% - ${config.width})`;
      wrapper.appendChild(nameEl);
    }

    // --- Bar background container ---
    const bg = document.createElement("div");
    bg.className = "bar-background";
    bg.style.height = heightStr;
    if (config.width) {
      bg.style.width = config.width;
      wrapper.style.alignItems = "center";
    }

    // Background tint
    const bgBar = document.createElement("div");
    bgBar.className = "bar-bg-tint";
    bgBar.style.setProperty("--bar-color", barColor);
    bg.appendChild(bgBar);

    // Animation bar
    if (config.animation && config.animation.state === "on" && indicator) {
      const animBar = document.createElement("div");
      animBar.className = `bar-animation ${isVertical ? "anim-vertical" : "anim-horizontal"}`;
      animBar.style.setProperty("--bar-color", barColor);
      animBar.style.setProperty("--bar-percent", `${barPct}%`);
      const animName =
        indicator === "▲"
          ? isVertical
            ? "anim-increase-v"
            : "anim-increase-h"
          : isVertical
          ? "anim-decrease-v"
          : "anim-decrease-h";
      animBar.style.animation = `${animName} ${config.animation.speed}s infinite ease-out`;
      bg.appendChild(animBar);
    }

    // Current bar fill
    const currentBar = document.createElement("div");
    currentBar.className = "bar-current";
    currentBar.style.setProperty("--bar-color", barColor);
    currentBar.style.setProperty("--bar-percent", `${barPct}%`);
    currentBar.style.setProperty("--bar-direction", barDirection);
    bg.appendChild(currentBar);

    // Target marker
    if (config.target != null) {
      let targetPct = percent(config.target, config.min, config.max);
      targetPct = clamp(targetPct, 0, 100);
      let tStart = Math.min(barPct, targetPct);
      let tEnd = Math.max(barPct, targetPct);

      const targetBar = document.createElement("div");
      targetBar.className = "bar-target";
      targetBar.style.setProperty("--bar-color", barColor);
      targetBar.style.setProperty("--bar-start", `${tStart}%`);
      targetBar.style.setProperty("--bar-end", `${tEnd}%`);
      targetBar.style.setProperty("--bar-direction", barDirection);
      bg.appendChild(targetBar);

      const marker = document.createElement("div");
      marker.className = `bar-marker ${isVertical ? "marker-v" : "marker-h"}`;
      marker.style.setProperty("--bar-color", barColor);
      if (isVertical) {
        marker.style.bottom = `${targetPct}%`;
      } else {
        marker.style.left = `${targetPct}%`;
      }
      bg.appendChild(marker);
    }

    // Content bar (items inside the bar)
    const contentBar = document.createElement("div");
    contentBar.className = `bar-content ${isVertical ? "content-vertical" : "content-horizontal"}`;

    if (positions.icon === "inside") contentBar.appendChild(this._iconEl(icon));
    if (positions.indicator === "inside") contentBar.appendChild(this._indicatorEl(indicator, barColor, ""));

    if (positions.name === "inside") {
      const nameEl = document.createElement("span");
      nameEl.className = "bar-name";
      nameEl.textContent = name;
      contentBar.appendChild(nameEl);
    }

    if (positions.minmax === "inside") {
      contentBar.appendChild(this._minMaxEl(config.min, config.max, unit, isVertical, "inside"));
    }

    if (positions.value === "inside") {
      const valEl = document.createElement("span");
      valEl.className = `bar-value ${
        positions.minmax !== "inside" ? (isVertical ? "val-push-vertical" : "val-push-right") : ""
      }`;
      valEl.textContent = `${displayValue} ${unit}`.trim();
      contentBar.appendChild(valEl);
    }

    bg.appendChild(contentBar);
    wrapper.appendChild(bg);

    // Minmax outside
    if (positions.minmax === "outside") {
      wrapper.appendChild(this._minMaxEl(config.min, config.max, unit, isVertical, "outside"));
    }

    // Value outside
    if (positions.value === "outside") {
      const valEl = document.createElement("span");
      valEl.className = `bar-value ${isVertical ? "val-push-vertical" : "val-push-right"}`;
      valEl.textContent = `${displayValue} ${unit}`.trim();
      wrapper.appendChild(valEl);
    }

    // Indicator outside (vertical position – below bar)
    if (positions.indicator === "outside" && isVertical) {
      wrapper.appendChild(this._indicatorEl(indicator, barColor, "outside-up"));
    }

    return wrapper;
  }

  // --- Small DOM helpers -----------------------------------------------------

  _iconEl(icon) {
    const wrap = document.createElement("div");
    wrap.className = "bar-icon";
    const haIcon = document.createElement("ha-icon");
    haIcon.setAttribute("icon", icon);
    wrap.appendChild(haIcon);
    return wrap;
  }

  _indicatorEl(text, color, cls) {
    const el = document.createElement("span");
    el.className = `bar-indicator ${cls}`;
    el.style.color = color;
    el.textContent = text;
    return el;
  }

  _minMaxEl(min, max, unit, isVertical, position) {
    const frag = document.createElement("span");
    frag.className = `bar-minmax ${position}`;
    frag.innerHTML = `<span class="mm-min ${isVertical ? "mm-push-vertical" : "mm-push-right"}">${min}${unit}</span>` +
      `<span class="mm-div">/</span>` +
      `<span class="mm-max">${max}${unit}</span>`;
    return frag;
  }

  // --- Severity helpers ------------------------------------------------------

  _checkSeverityHide(rawValue, numericValue, severity) {
    if (!severity) return false;
    for (const s of severity) {
      if (numericValue !== null && s.from != null && s.to != null) {
        if (numericValue >= s.from && numericValue <= s.to && s.hide) return true;
      } else if (s.text != null && rawValue === s.text && s.hide) {
        return true;
      }
    }
    return false;
  }

  _severityColor(rawValue, numericValue, severity) {
    if (!severity) return null;
    for (const s of severity) {
      if (numericValue !== null && s.from != null && s.to != null) {
        if (numericValue >= s.from && numericValue <= s.to) return s.color;
      } else if (s.text != null && rawValue === s.text) {
        return s.color;
      }
    }
    return null;
  }

  _severityIcon(rawValue, numericValue, severity) {
    if (!severity) return null;
    for (const s of severity) {
      if (numericValue !== null && s.from != null && s.to != null) {
        if (numericValue >= s.from && numericValue <= s.to && s.icon) return s.icon;
      } else if (s.text != null && rawValue === s.text && s.icon) {
        return s.icon;
      }
    }
    return null;
  }

  // --- Action handling -------------------------------------------------------

  _handleTap(config) {
    if (!this._hass) return;
    const action = config.tap_action || { action: "more-info" };
    if (action.action === "more-info") {
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: config.entity };
      this.dispatchEvent(ev);
    } else if (action.action === "toggle") {
      this._hass.callService("homeassistant", "toggle", { entity_id: config.entity });
    } else if (action.action === "call-service" && action.service) {
      const [domain, service] = action.service.split(".");
      this._hass.callService(domain, service, action.service_data || {});
    } else if (action.action === "navigate" && action.navigation_path) {
      history.pushState(null, "", action.navigation_path);
      const navEv = new Event("location-changed", { bubbles: true, composed: true });
      navEv.detail = { replace: false };
      window.dispatchEvent(navEv);
    } else if (action.action === "url" && action.url_path) {
      window.open(action.url_path);
    }
  }

  // --- Styles ----------------------------------------------------------------

  static _styles() {
    return `
      :host {
        display: block;
      }
      ha-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }
      ha-card.entity-row-mode {
        background: transparent;
        box-shadow: none;
        border: none;
      }
      .card-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        flex-grow: 0;
      }
      .card-content.grow {
        flex-grow: 1;
      }
      ha-card.entity-row-mode .card-content {
        padding: 0;
      }

      /* Rows */
      .bar-row {
        display: flex;
        flex-direction: column;
      }
      .bar-row.multi-col {
        flex-direction: row;
        gap: 8px;
      }
      .bar-row.multi-col > * {
        flex: 1 1 0;
        min-width: 0;
      }

      /* Bar wrapper */
      .bar-wrapper {
        display: flex;
        align-items: stretch;
        cursor: pointer;
      }
      .bar-wrapper.horizontal {
        flex-direction: row;
        align-items: center;
      }
      .bar-wrapper.vertical {
        flex-direction: column-reverse;
        align-items: center;
      }

      /* Bar background */
      .bar-background {
        flex: 1 1 auto;
        position: relative;
        border-radius: var(--bar-card-border-radius, var(--ha-card-border-radius, 6px));
        overflow: hidden;
        min-width: 0;
      }

      /* Background tint */
      .bar-bg-tint {
        position: absolute;
        inset: 0;
        background: var(--bar-color);
        opacity: 0.15;
      }

      /* Current fill */
      .bar-current {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to var(--bar-direction, right),
          var(--bar-color) var(--bar-percent, 0%),
          transparent var(--bar-percent, 0%)
        );
        transition: --bar-percent 0.8s ease;
      }

      /* Target bar */
      .bar-target {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to var(--bar-direction, right),
          transparent var(--bar-start, 0%),
          var(--bar-color) var(--bar-start, 0%),
          var(--bar-color) var(--bar-end, 0%),
          transparent var(--bar-end, 0%)
        );
        opacity: 0.2;
      }

      /* Target marker */
      .bar-marker {
        position: absolute;
        background: var(--bar-color);
        opacity: 0.6;
        filter: brightness(0.75);
      }
      .bar-marker.marker-h {
        top: 0; bottom: 0;
        width: 2px;
        transform: translateX(-1px);
      }
      .bar-marker.marker-v {
        left: 0; right: 0;
        height: 2px;
        transform: translateY(1px);
      }

      /* Animation bar */
      .bar-animation {
        position: absolute;
        inset: 0;
        opacity: 0;
        filter: brightness(0.75);
      }
      .anim-horizontal {
        background: linear-gradient(to right, var(--bar-color) 0%, var(--bar-color) 1%, transparent 1%);
        background-repeat: no-repeat;
      }
      .anim-vertical {
        background: linear-gradient(to bottom, transparent 0%, transparent 1%, var(--bar-color) 1%);
        background-repeat: no-repeat;
      }

      @keyframes anim-increase-h {
        0%   { opacity: 0.5; background-size: var(--bar-percent) 100%; }
        100% { opacity: 0;   background-size: 10000% 100%; }
      }
      @keyframes anim-decrease-h {
        0%   { opacity: 0;   background-size: 10000% 100%; }
        100% { opacity: 0.5; background-size: var(--bar-percent) 100%; }
      }
      @keyframes anim-increase-v {
        0%   { opacity: 0.5; background-size: 100% var(--bar-percent); }
        100% { opacity: 0;   background-size: 100% 0%; }
      }
      @keyframes anim-decrease-v {
        0%   { opacity: 0;   background-size: 100% 100%; }
        100% { opacity: 0.5; background-size: 100% var(--bar-percent); }
      }

      /* Content inside bar */
      .bar-content {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        color: var(--primary-text-color);
        z-index: 1;
        padding: 0 4px;
        overflow: hidden;
        gap: 4px;
      }
      .content-horizontal {
        flex-direction: row;
      }
      .content-vertical {
        flex-direction: column;
        justify-content: flex-end;
        padding: 4px 0;
      }

      /* Icon */
      .bar-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        min-width: 40px;
        height: 40px;
        color: var(--icon-color, var(--state-icon-color, var(--paper-item-icon-color)));
      }

      /* Name */
      .bar-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0 4px;
      }
      .bar-name.outside {
        margin-left: 16px;
      }

      /* Value */
      .bar-value {
        white-space: nowrap;
        margin: 0 4px;
      }
      .val-push-right {
        margin-left: auto;
      }
      .val-push-vertical {
        margin-top: auto;
      }

      /* Indicator */
      .bar-indicator {
        font-size: 12px;
        min-width: 14px;
        text-align: center;
        filter: brightness(0.75);
      }
      .outside-right {
        margin-right: -2px;
        position: relative;
        left: -4px;
      }

      /* MinMax */
      .bar-minmax {
        display: inline-flex;
        align-items: center;
        font-size: 10px;
        opacity: 0.5;
        gap: 1px;
        white-space: nowrap;
      }
      .mm-push-right { margin-left: auto; }
      .mm-push-vertical { margin-top: auto; }

      /* Warning */
      .warning {
        background: #fce588;
        color: #333;
        padding: 8px;
        border-radius: 4px;
        font-size: 13px;
      }
    `;
  }
}

customElements.define("bar-card", BarCard);

// Register in the card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "bar-card",
  name: "Bar Card",
  preview: true,
  description: "A customizable bar/gauge card for displaying entity values as horizontal or vertical bars.",
  documentationURL: "https://github.com/custom-cards/bar-card",
});
