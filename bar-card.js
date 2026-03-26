/**
 * Bar Card Revamped v1.0.0
 * A custom bar/gauge card for Home Assistant dashboards.
 *
 * Rebuilt from the ground up using modern Home Assistant standards (2026):
 *   - Vanilla custom elements with Shadow DOM (no build step)
 *   - Custom getConfigElement() visual editor with multi-entity support
 *   - getGridOptions() for sections view
 *   - Proper ha-card theming via CSS custom properties
 *   - Registered in window.customCards for the card picker
 *
 * Original concept by custom-cards/bar-card (v3.x), rebuilt as Bar Card Revamped.
 */

const CARD_VERSION = "1.0.0";

console.info(
  `%c  BAR-CARD REVAMPED %c v${CARD_VERSION} `,
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

function domainIcon(entityId) {
  const domain = entityId ? entityId.split(".")[0] : "";
  const icons = {
    sensor: "mdi:eye", binary_sensor: "mdi:checkbox-blank-circle",
    light: "mdi:lightbulb", switch: "mdi:toggle-switch", fan: "mdi:fan",
    climate: "mdi:thermostat", cover: "mdi:window-shutter",
    media_player: "mdi:cast", input_number: "mdi:ray-vertex",
    number: "mdi:ray-vertex", humidifier: "mdi:air-humidifier",
    vacuum: "mdi:robot-vacuum", person: "mdi:account",
    weather: "mdi:weather-partly-cloudy", water_heater: "mdi:water-boiler",
  };
  return icons[domain] || "mdi:bookmark";
}

function buildConfigArray(config) {
  const base = { ...config };
  delete base.entities;
  const arr = [];
  if (config.entities && config.entities.length) {
    for (const ent of config.entities) {
      if (typeof ent === "string") arr.push(deepMerge({}, base, { entity: ent }));
      else arr.push(deepMerge({}, base, ent));
    }
  } else if (config.entity) {
    arr.push(deepMerge({}, base));
  }
  return arr;
}

function fireEvent(node, type, detail) {
  node.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

// Zone coloration: 5-zone system with 4 thresholds and 3 colors
// cold → cool → comfort → warm → hot
// color_low (outer extremes), color_mid (caution), color_high (comfort)
function zoneColor(value, zones) {
  if (value == null || isNaN(value) || !zones) return null;
  const cold = zones.cold_threshold ?? 55;
  const cool = zones.cool_threshold ?? 62;
  const warm = zones.warm_threshold ?? 78;
  const hot  = zones.hot_threshold  ?? 85;
  const cLow  = zones.color_low  || "#E24B4A";
  const cMid  = zones.color_mid  || "#EF9F27";
  const cHigh = zones.color_high || "#5DCAA5";

  if (value < cold) return cLow;
  if (value < cool) return cMid;
  if (value <= warm) return cHigh;
  if (value <= hot)  return cMid;
  return cLow;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CARD ELEMENT
// ═══════════════════════════════════════════════════════════════════════════════

class BarCard extends HTMLElement {

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
          icon: "outside", indicator: "outside",
          name: "inside", minmax: "off", value: "inside",
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

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (this._hass) this._render();
  }

  getCardSize() {
    const h = typeof this._config.height === "number" ? this._config.height : parseInt(this._config.height) || 40;
    const rows = Math.ceil(this._configArray.length / (this._config.columns || 1));
    const titleSize = this._config.title ? 1 : 0;
    return Math.max(1, Math.round((h * rows) / 50) + 1 + titleSize);
  }

  getGridOptions() {
    const barRows = Math.max(1, Math.ceil(this._configArray.length / (this._config.columns || 1)));
    const titleRows = this._config.title ? 1 : 0;
    return {
      rows: barRows + titleRows,
      columns: 12, min_rows: 1, min_columns: 3,
    };
  }

  static getConfigElement() {
    return document.createElement("bar-card-editor");
  }

  static getStubConfig() {
    return { entity: "", min: 0, max: 100 };
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    if (!this._hass || !this._config) return;
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = BarCard._styles();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    if (this._config.title) card.setAttribute("header", this._config.title);
    if (this._config.entity_row) card.classList.add("entity-row-mode");

    const content = document.createElement("div");
    content.className = "card-content";
    if (this._config.direction === "up") content.classList.add("grow");

    const columns = this._config.columns || 1;
    for (let i = 0; i < this._configArray.length; i += columns) {
      const rowEl = document.createElement("div");
      rowEl.className = "bar-row";
      if (columns > 1) rowEl.classList.add("multi-col");
      for (let c = 0; c < columns && i + c < this._configArray.length; c++) {
        const barEl = this._createBar(this._configArray[i + c], i + c);
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

    let rawValue = config.attribute ? stateObj.attributes[config.attribute] : stateObj.state;
    const isNumeric = !isNaN(Number(rawValue)) && rawValue !== "" && rawValue !== null;
    let numericValue = isNumeric ? Number(rawValue) : null;

    if (config.severity && this._checkSeverityHide(rawValue, numericValue, config.severity)) return null;
    if (config.limit_value && numericValue !== null) numericValue = clamp(numericValue, config.min, config.max);

    let displayValue;
    if (numericValue !== null) {
      if (config.complementary) numericValue = config.max - numericValue;
      displayValue = config.decimal != null ? numericValue.toFixed(config.decimal) : String(numericValue);
    } else {
      displayValue = String(rawValue);
    }

    let barSourceValue = config.attribute ? Number(stateObj.attributes[config.attribute]) : Number(stateObj.state);
    if (isNaN(barSourceValue)) barSourceValue = null;
    if (config.limit_value && barSourceValue !== null) barSourceValue = clamp(barSourceValue, config.min, config.max);

    let barPct = 0;
    if (rawValue === "unavailable" || rawValue === "unknown") barPct = 0;
    else if (barSourceValue !== null) barPct = percent(barSourceValue, config.min, config.max);
    else barPct = 100;

    if (config.direction && config.direction.endsWith("-reverse")) barPct = 100 - barPct;
    barPct = clamp(barPct, 0, 100);

    let barColor = config.color;
    if (config.severity) barColor = this._severityColor(rawValue, numericValue, config.severity) || barColor;
    if (config.zones && numericValue !== null) barColor = zoneColor(numericValue, config.zones) || barColor;
    if (rawValue === "unavailable") barColor = `var(--bar-card-disabled-color, var(--disabled-color, ${config.color}))`;

    const prevKey = `${config.entity}_${config.attribute || ""}`;
    const prevVal = this._prevStates[prevKey];
    let indicator = this._indicators[prevKey] || "";
    if (isNumeric && prevVal !== undefined) {
      if (Number(rawValue) > prevVal) indicator = "▲";
      else if (Number(rawValue) < prevVal) indicator = "▼";
    }
    if (isNumeric) this._prevStates[prevKey] = Number(rawValue);
    this._indicators[prevKey] = indicator;

    let icon = null;
    if (config.severity) icon = this._severityIcon(rawValue, numericValue, config.severity);
    if (!icon) icon = config.icon || stateObj.attributes.icon || domainIcon(config.entity);

    const name = config.name || stateObj.attributes.friendly_name || config.entity;
    let unit = "";
    if (isNumeric) unit = config.unit_of_measurement ?? stateObj.attributes.unit_of_measurement ?? "";

    const isVertical = config.direction === "up" || config.direction === "up-reverse";
    const barDirection = isVertical ? "top" : "right";
    const heightStr = typeof config.height === "number" ? `${config.height}px` : config.height;
    const positions = config.positions || {};

    const wrapper = document.createElement("div");
    wrapper.className = `bar-wrapper ${isVertical ? "vertical" : "horizontal"}`;
    wrapper.addEventListener("click", () => this._handleTap(config));

    if (positions.icon === "outside") wrapper.appendChild(this._iconEl(icon));
    if (positions.indicator === "outside" && !isVertical) wrapper.appendChild(this._indicatorEl(indicator, barColor, "outside-right"));

    if (positions.name === "outside") {
      const nameEl = document.createElement("span");
      nameEl.className = "bar-name outside";
      nameEl.textContent = name;
      if (!isVertical && config.width) nameEl.style.width = `calc(100% - ${config.width})`;
      wrapper.appendChild(nameEl);
    }

    const bg = document.createElement("div");
    bg.className = "bar-background";
    bg.style.height = heightStr;
    if (config.width) { bg.style.width = config.width; wrapper.style.alignItems = "center"; }

    const bgBar = document.createElement("div");
    bgBar.className = "bar-bg-tint";
    bgBar.style.setProperty("--bar-color", barColor);
    bg.appendChild(bgBar);

    if (config.animation && config.animation.state === "on" && indicator) {
      const animBar = document.createElement("div");
      animBar.className = `bar-animation ${isVertical ? "anim-vertical" : "anim-horizontal"}`;
      animBar.style.setProperty("--bar-color", barColor);
      animBar.style.setProperty("--bar-percent", `${barPct}%`);
      const animName = indicator === "▲"
        ? (isVertical ? "anim-increase-v" : "anim-increase-h")
        : (isVertical ? "anim-decrease-v" : "anim-decrease-h");
      animBar.style.animation = `${animName} ${config.animation.speed}s infinite ease-out`;
      bg.appendChild(animBar);
    }

    const currentBar = document.createElement("div");
    currentBar.className = "bar-current";
    currentBar.style.setProperty("--bar-color", barColor);
    currentBar.style.setProperty("--bar-percent", `${barPct}%`);
    currentBar.style.setProperty("--bar-direction", barDirection);
    bg.appendChild(currentBar);

    if (config.target != null) {
      let targetPct = clamp(percent(config.target, config.min, config.max), 0, 100);
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
      if (isVertical) marker.style.bottom = `${targetPct}%`;
      else marker.style.left = `${targetPct}%`;
      bg.appendChild(marker);
    }

    const contentBar = document.createElement("div");
    contentBar.className = `bar-content ${isVertical ? "content-vertical" : "content-horizontal"}`;

    if (positions.icon === "inside") contentBar.appendChild(this._iconEl(icon));
    if (positions.indicator === "inside") contentBar.appendChild(this._indicatorEl(indicator, barColor, ""));
    if (positions.name === "inside") {
      const n = document.createElement("span"); n.className = "bar-name"; n.textContent = name;
      contentBar.appendChild(n);
    }
    if (positions.minmax === "inside") contentBar.appendChild(this._minMaxEl(config.min, config.max, unit, isVertical, "inside"));
    if (positions.value === "inside") {
      const v = document.createElement("span");
      v.className = `bar-value ${positions.minmax !== "inside" ? (isVertical ? "val-push-vertical" : "val-push-right") : ""}`;
      v.textContent = `${displayValue} ${unit}`.trim();
      contentBar.appendChild(v);
    }

    bg.appendChild(contentBar);
    wrapper.appendChild(bg);

    if (positions.minmax === "outside") wrapper.appendChild(this._minMaxEl(config.min, config.max, unit, isVertical, "outside"));
    if (positions.value === "outside") {
      const v = document.createElement("span");
      v.className = `bar-value ${isVertical ? "val-push-vertical" : "val-push-right"}`;
      v.textContent = `${displayValue} ${unit}`.trim();
      wrapper.appendChild(v);
    }
    if (positions.indicator === "outside" && isVertical) wrapper.appendChild(this._indicatorEl(indicator, barColor, "outside-up"));

    return wrapper;
  }

  _iconEl(icon) {
    const wrap = document.createElement("div"); wrap.className = "bar-icon";
    const haIcon = document.createElement("ha-icon"); haIcon.setAttribute("icon", icon);
    wrap.appendChild(haIcon); return wrap;
  }

  _indicatorEl(text, color, cls) {
    const el = document.createElement("span");
    el.className = `bar-indicator ${cls}`; el.style.color = color; el.textContent = text;
    return el;
  }

  _minMaxEl(min, max, unit, isVertical, position) {
    const frag = document.createElement("span");
    frag.className = `bar-minmax ${position}`;
    frag.innerHTML =
      `<span class="mm-min ${isVertical ? "mm-push-vertical" : "mm-push-right"}">${min}${unit}</span>` +
      `<span class="mm-div">/</span>` +
      `<span class="mm-max">${max}${unit}</span>`;
    return frag;
  }

  _checkSeverityHide(rawValue, numericValue, severity) {
    if (!severity) return false;
    for (const s of severity) {
      if (numericValue !== null && s.from != null && s.to != null) {
        if (numericValue >= s.from && numericValue <= s.to && s.hide) return true;
      } else if (s.text != null && rawValue === s.text && s.hide) return true;
    }
    return false;
  }

  _severityColor(rawValue, numericValue, severity) {
    if (!severity) return null;
    for (const s of severity) {
      if (numericValue !== null && s.from != null && s.to != null) {
        if (numericValue >= s.from && numericValue <= s.to) return s.color;
      } else if (s.text != null && rawValue === s.text) return s.color;
    }
    return null;
  }

  _severityIcon(rawValue, numericValue, severity) {
    if (!severity) return null;
    for (const s of severity) {
      if (numericValue !== null && s.from != null && s.to != null) {
        if (numericValue >= s.from && numericValue <= s.to && s.icon) return s.icon;
      } else if (s.text != null && rawValue === s.text && s.icon) return s.icon;
    }
    return null;
  }

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
      window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true, detail: { replace: false } }));
    } else if (action.action === "url" && action.url_path) {
      window.open(action.url_path);
    }
  }

  static _styles() {
    return /* css */ `
      :host { display: block; }
      ha-card { display: flex; flex-direction: column; overflow: hidden; }
      ha-card.entity-row-mode { background: transparent; box-shadow: none; border: none; }
      .card-content { display: flex; flex-direction: column; gap: 8px; padding: 16px; flex-grow: 0; }
      .card-content.grow { flex-grow: 1; }
      ha-card.entity-row-mode .card-content { padding: 0; }

      .bar-row { display: flex; flex-direction: column; }
      .bar-row.multi-col { flex-direction: row; gap: 8px; }
      .bar-row.multi-col > * { flex: 1 1 0; min-width: 0; }

      .bar-wrapper { display: flex; cursor: pointer; }
      .bar-wrapper.horizontal { flex-direction: row; align-items: center; }
      .bar-wrapper.vertical { flex-direction: column-reverse; align-items: center; }

      .bar-background {
        flex: 1 1 auto; position: relative;
        border-radius: var(--bar-card-border-radius, var(--ha-card-border-radius, 6px));
        overflow: hidden; min-width: 0;
      }
      .bar-bg-tint { position: absolute; inset: 0; background: var(--bar-color); opacity: 0.15; }
      .bar-current {
        position: absolute; inset: 0;
        background: linear-gradient(to var(--bar-direction, right), var(--bar-color) var(--bar-percent, 0%), transparent var(--bar-percent, 0%));
      }
      .bar-target {
        position: absolute; inset: 0;
        background: linear-gradient(to var(--bar-direction, right), transparent var(--bar-start, 0%), var(--bar-color) var(--bar-start, 0%), var(--bar-color) var(--bar-end, 0%), transparent var(--bar-end, 0%));
        opacity: 0.2;
      }
      .bar-marker { position: absolute; background: var(--bar-color); opacity: 0.6; filter: brightness(0.75); }
      .bar-marker.marker-h { top: 0; bottom: 0; width: 2px; transform: translateX(-1px); }
      .bar-marker.marker-v { left: 0; right: 0; height: 2px; transform: translateY(1px); }

      .bar-animation { position: absolute; inset: 0; opacity: 0; filter: brightness(0.75); }
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

      .bar-content {
        position: absolute; inset: 0; display: flex; align-items: center;
        color: var(--primary-text-color); z-index: 1; padding: 0 4px; overflow: hidden; gap: 4px;
      }
      .content-horizontal { flex-direction: row; }
      .content-vertical { flex-direction: column; justify-content: flex-end; padding: 4px 0; }

      .bar-icon {
        display: flex; align-items: center; justify-content: center;
        width: 40px; min-width: 40px; height: 40px;
        color: var(--icon-color, var(--state-icon-color, var(--paper-item-icon-color)));
      }
      .bar-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0 4px; }
      .bar-name.outside { margin-left: 16px; }
      .bar-value { white-space: nowrap; margin: 0 4px; }
      .val-push-right { margin-left: auto; }
      .val-push-vertical { margin-top: auto; }
      .bar-indicator { font-size: 12px; min-width: 14px; text-align: center; filter: brightness(0.75); }
      .outside-right { margin-right: -2px; position: relative; left: -4px; }
      .bar-minmax { display: inline-flex; align-items: center; font-size: 10px; opacity: 0.5; gap: 1px; white-space: nowrap; }
      .mm-push-right { margin-left: auto; }
      .mm-push-vertical { margin-top: auto; }
      .warning { background: #fce588; color: #333; padding: 8px; border-radius: 4px; font-size: 13px; }
    `;
  }
}

customElements.define("bar-card", BarCard);


// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR ELEMENT
// ═══════════════════════════════════════════════════════════════════════════════

class BarCardEditor extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._expandedEntity = -1;
  }

  set hass(hass) {
    const firstHass = !this._hass;
    this._hass = hass;
    if (firstHass && this._config && this._config.entities) {
      // First hass arrival — re-render so pickers are created with hass
      this._render();
    } else if (this.shadowRoot) {
      this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((el) => {
        el.hass = hass;
      });
    }
  }

  setConfig(config) {
    this._config = { ...config };

    // Normalise: single entity → entities array for editor
    if (this._config.entity && !this._config.entities) {
      this._config.entities = [{ entity: this._config.entity }];
      delete this._config.entity;
    }
    if (!this._config.entities) this._config.entities = [];

    this._config.entities = this._config.entities.map((e) =>
      typeof e === "string" ? { entity: e } : { ...e }
    );

    this._render();
  }

  _fireConfigChanged() {
    const cfg = { ...this._config };

    // Flatten single entity back if no per-entity overrides
    if (cfg.entities && cfg.entities.length === 1) {
      const ent = cfg.entities[0];
      const overrideKeys = Object.keys(ent).filter((k) => k !== "entity");
      if (overrideKeys.length === 0) {
        cfg.entity = ent.entity;
        delete cfg.entities;
      }
    }

    fireEvent(this, "config-changed", { config: cfg });
  }

  // ─── Full editor render ────────────────────────────────────────────────────

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = BarCardEditor._styles();
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "editor";

    // ── TITLE ──
    wrap.appendChild(this._field("Title", "text", this._config.title || "", (v) => {
      if (v) this._config.title = v; else delete this._config.title;
      this._fireConfigChanged();
    }));

    // ── ENTITIES LIST ──
    const entSection = document.createElement("div");
    entSection.className = "section";

    const entHeader = document.createElement("div");
    entHeader.className = "section-header";
    entHeader.innerHTML = `<span>Entities</span>`;
    entSection.appendChild(entHeader);

    const entList = document.createElement("div");
    entList.className = "entity-list";

    (this._config.entities || []).forEach((entCfg, idx) => {
      entList.appendChild(this._entityRow(entCfg, idx));
    });

    entSection.appendChild(entList);

    // Add entity button
    const addBtn = document.createElement("ha-button");
    addBtn.textContent = "Add Entity";
    addBtn.addEventListener("click", () => {
      this._config.entities = this._config.entities || [];
      this._config.entities.push({ entity: "" });
      this._fireConfigChanged();
      this._render();
    });
    entSection.appendChild(addBtn);
    wrap.appendChild(entSection);

    // ── GLOBAL APPEARANCE (collapsible) ──
    const appSection = document.createElement("div");
    appSection.className = "section";
    const appHeader = document.createElement("div");
    appHeader.className = "section-header clickable";
    appHeader.innerHTML = `<span>Appearance</span><ha-icon icon="mdi:chevron-down"></ha-icon>`;
    let appOpen = false;
    const appBody = document.createElement("div");
    appBody.className = "section-body";
    appBody.style.display = "none";

    appHeader.addEventListener("click", () => {
      appOpen = !appOpen;
      appBody.style.display = appOpen ? "block" : "none";
      appHeader.querySelector("ha-icon").setAttribute("icon", appOpen ? "mdi:chevron-up" : "mdi:chevron-down");
    });
    appSection.appendChild(appHeader);

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.appendChild(this._field("Min", "number", this._config.min ?? 0, (v) => {
      this._config.min = v !== "" ? Number(v) : 0; this._fireConfigChanged();
    }));
    grid.appendChild(this._field("Max", "number", this._config.max ?? 100, (v) => {
      this._config.max = v !== "" ? Number(v) : 100; this._fireConfigChanged();
    }));
    grid.appendChild(this._field("Height (px)", "number", this._config.height ?? 40, (v) => {
      this._config.height = v !== "" ? Number(v) : 40; this._fireConfigChanged();
    }));
    grid.appendChild(this._field("Decimals", "number", this._config.decimal ?? "", (v) => {
      if (v !== "" && v !== null) this._config.decimal = Number(v); else delete this._config.decimal;
      this._fireConfigChanged();
    }));
    grid.appendChild(this._field("Columns", "number", this._config.columns ?? 1, (v) => {
      this._config.columns = v !== "" ? Number(v) : 1; this._fireConfigChanged();
    }));
    grid.appendChild(this._field("Color", "text", this._config.color ?? "", (v) => {
      if (v) this._config.color = v; else delete this._config.color; this._fireConfigChanged();
    }));
    grid.appendChild(this._field("Target", "number", this._config.target ?? "", (v) => {
      if (v !== "" && v !== null) this._config.target = Number(v); else delete this._config.target;
      this._fireConfigChanged();
    }));
    appBody.appendChild(grid);

    // Direction
    appBody.appendChild(this._select("Direction", this._config.direction || "right", [
      { value: "right", label: "Right" }, { value: "up", label: "Up" },
      { value: "right-reverse", label: "Right (reverse)" }, { value: "up-reverse", label: "Up (reverse)" },
    ], (v) => { this._config.direction = v; this._fireConfigChanged(); }));

    // Positions
    const posLabel = document.createElement("div");
    posLabel.className = "sub-label"; posLabel.textContent = "Element Positions";
    appBody.appendChild(posLabel);

    const posGrid = document.createElement("div");
    posGrid.className = "grid";
    const posOpts = [
      { value: "inside", label: "Inside" }, { value: "outside", label: "Outside" }, { value: "off", label: "Off" },
    ];
    const positions = this._config.positions || {};
    for (const key of ["icon", "indicator", "name", "value", "minmax"]) {
      const def = key === "minmax" ? "off" : (key === "name" || key === "value") ? "inside" : "outside";
      posGrid.appendChild(this._select(
        key.charAt(0).toUpperCase() + key.slice(1), positions[key] || def, posOpts,
        (v) => {
          if (!this._config.positions) this._config.positions = {};
          this._config.positions[key] = v; this._fireConfigChanged();
        }
      ));
    }
    appBody.appendChild(posGrid);

    // Toggles
    const toggleGrid = document.createElement("div");
    toggleGrid.className = "grid";
    toggleGrid.appendChild(this._toggle("Limit Value", this._config.limit_value || false, (v) => {
      this._config.limit_value = v; this._fireConfigChanged();
    }));
    toggleGrid.appendChild(this._toggle("Complementary", this._config.complementary || false, (v) => {
      this._config.complementary = v; this._fireConfigChanged();
    }));
    toggleGrid.appendChild(this._toggle("Entity Row", this._config.entity_row || false, (v) => {
      this._config.entity_row = v; this._fireConfigChanged();
    }));
    appBody.appendChild(toggleGrid);

    // Animation
    const animLabel = document.createElement("div");
    animLabel.className = "sub-label"; animLabel.textContent = "Animation";
    appBody.appendChild(animLabel);
    const animGrid = document.createElement("div");
    animGrid.className = "grid";
    const anim = this._config.animation || {};
    animGrid.appendChild(this._select("State", anim.state || "off", [
      { value: "off", label: "Off" }, { value: "on", label: "On" },
    ], (v) => {
      if (!this._config.animation) this._config.animation = {};
      this._config.animation.state = v; this._fireConfigChanged();
    }));
    animGrid.appendChild(this._field("Speed (s)", "number", anim.speed ?? 5, (v) => {
      if (!this._config.animation) this._config.animation = {};
      this._config.animation.speed = v !== "" ? Number(v) : 5; this._fireConfigChanged();
    }));
    appBody.appendChild(animGrid);

    // Zones
    const zonesLabel = document.createElement("div");
    zonesLabel.className = "sub-label"; zonesLabel.textContent = "Zone Colors";
    appBody.appendChild(zonesLabel);
    const zonesHint = document.createElement("div");
    zonesHint.className = "hint";
    zonesHint.style.marginTop = "0";
    zonesHint.style.marginBottom = "8px";
    zonesHint.textContent = "Five-zone color system: outer → caution → comfort → caution → outer";
    appBody.appendChild(zonesHint);

    const zones = this._config.zones || {};
    const zonesGrid = document.createElement("div");
    zonesGrid.className = "grid";
    zonesGrid.appendChild(this._field("Cold Threshold", "number", zones.cold_threshold ?? "", (v) => {
      if (!this._config.zones) this._config.zones = {};
      if (v !== "" && v !== null) this._config.zones.cold_threshold = Number(v); else delete this._config.zones.cold_threshold;
      this._cleanZones(); this._fireConfigChanged();
    }));
    zonesGrid.appendChild(this._field("Cool Threshold", "number", zones.cool_threshold ?? "", (v) => {
      if (!this._config.zones) this._config.zones = {};
      if (v !== "" && v !== null) this._config.zones.cool_threshold = Number(v); else delete this._config.zones.cool_threshold;
      this._cleanZones(); this._fireConfigChanged();
    }));
    zonesGrid.appendChild(this._field("Warm Threshold", "number", zones.warm_threshold ?? "", (v) => {
      if (!this._config.zones) this._config.zones = {};
      if (v !== "" && v !== null) this._config.zones.warm_threshold = Number(v); else delete this._config.zones.warm_threshold;
      this._cleanZones(); this._fireConfigChanged();
    }));
    zonesGrid.appendChild(this._field("Hot Threshold", "number", zones.hot_threshold ?? "", (v) => {
      if (!this._config.zones) this._config.zones = {};
      if (v !== "" && v !== null) this._config.zones.hot_threshold = Number(v); else delete this._config.zones.hot_threshold;
      this._cleanZones(); this._fireConfigChanged();
    }));
    zonesGrid.appendChild(this._field("Outer Color", "color", zones.color_low || "#E24B4A", (v) => {
      if (!this._config.zones) this._config.zones = {};
      this._config.zones.color_low = v; this._fireConfigChanged();
    }));
    zonesGrid.appendChild(this._field("Caution Color", "color", zones.color_mid || "#EF9F27", (v) => {
      if (!this._config.zones) this._config.zones = {};
      this._config.zones.color_mid = v; this._fireConfigChanged();
    }));
    zonesGrid.appendChild(this._field("Comfort Color", "color", zones.color_high || "#5DCAA5", (v) => {
      if (!this._config.zones) this._config.zones = {};
      this._config.zones.color_high = v; this._fireConfigChanged();
    }));
    appBody.appendChild(zonesGrid);

    appSection.appendChild(appBody);
    wrap.appendChild(appSection);
    root.appendChild(wrap);

    // Assign hass to entity pickers after they're in the DOM and upgraded.
    // ha-entity-picker needs hass to resolve friendly names; setting value
    // after hass triggers the label to render.
    if (this._hass) {
      const pickers = root.querySelectorAll("ha-entity-picker");
      pickers.forEach((el) => { el.hass = this._hass; });
      // Re-set value after a microtask so upgraded pickers re-render labels
      requestAnimationFrame(() => {
        pickers.forEach((el) => {
          el.hass = this._hass;
          if (el.value) {
            const v = el.value;
            el.value = "";
            el.value = v;
          }
        });
      });
    }
  }

  // ─── Entity row with expand/collapse per-entity options ────────────────────

  _entityRow(entCfg, idx) {
    const row = document.createElement("div");
    row.className = "entity-row";

    const main = document.createElement("div");
    main.className = "entity-main";

    // Entity picker
    const picker = document.createElement("ha-entity-picker");
    picker.allowCustomEntity = true;
    if (this._hass) picker.hass = this._hass;
    picker.value = entCfg.entity || "";
    picker.addEventListener("value-changed", (ev) => {
      this._config.entities[idx].entity = ev.detail.value || "";
      this._fireConfigChanged();
    });
    main.appendChild(picker);

    // Per-entity options toggle
    const optBtn = document.createElement("ha-icon-button");
    optBtn.innerHTML = `<ha-icon icon="mdi:${this._expandedEntity === idx ? "chevron-up" : "tune"}"></ha-icon>`;
    optBtn.title = "Entity options";
    optBtn.addEventListener("click", () => {
      this._expandedEntity = this._expandedEntity === idx ? -1 : idx;
      this._render();
    });
    main.appendChild(optBtn);

    // Move up
    const upBtn = document.createElement("ha-icon-button");
    upBtn.innerHTML = `<ha-icon icon="mdi:arrow-up"></ha-icon>`;
    upBtn.style.opacity = idx === 0 ? "0.3" : "1";
    if (idx > 0) {
      upBtn.addEventListener("click", () => {
        const arr = this._config.entities;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        if (this._expandedEntity === idx) this._expandedEntity = idx - 1;
        this._fireConfigChanged(); this._render();
      });
    }
    main.appendChild(upBtn);

    // Move down
    const downBtn = document.createElement("ha-icon-button");
    downBtn.innerHTML = `<ha-icon icon="mdi:arrow-down"></ha-icon>`;
    const isLast = idx >= (this._config.entities || []).length - 1;
    downBtn.style.opacity = isLast ? "0.3" : "1";
    if (!isLast) {
      downBtn.addEventListener("click", () => {
        const arr = this._config.entities;
        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
        if (this._expandedEntity === idx) this._expandedEntity = idx + 1;
        this._fireConfigChanged(); this._render();
      });
    }
    main.appendChild(downBtn);

    // Remove
    const removeBtn = document.createElement("ha-icon-button");
    removeBtn.innerHTML = `<ha-icon icon="mdi:close"></ha-icon>`;
    removeBtn.addEventListener("click", () => {
      this._config.entities.splice(idx, 1);
      if (this._expandedEntity === idx) this._expandedEntity = -1;
      else if (this._expandedEntity > idx) this._expandedEntity--;
      this._fireConfigChanged(); this._render();
    });
    main.appendChild(removeBtn);

    row.appendChild(main);

    // ── Expanded per-entity options panel ──
    if (this._expandedEntity === idx) {
      const opts = document.createElement("div");
      opts.className = "entity-options";
      const grid = document.createElement("div");
      grid.className = "grid";

      grid.appendChild(this._field("Name", "text", entCfg.name || "", (v) => {
        if (v) this._config.entities[idx].name = v; else delete this._config.entities[idx].name;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Icon", "text", entCfg.icon || "", (v) => {
        if (v) this._config.entities[idx].icon = v; else delete this._config.entities[idx].icon;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Attribute", "text", entCfg.attribute || "", (v) => {
        if (v) this._config.entities[idx].attribute = v; else delete this._config.entities[idx].attribute;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Unit", "text", entCfg.unit_of_measurement || "", (v) => {
        if (v) this._config.entities[idx].unit_of_measurement = v; else delete this._config.entities[idx].unit_of_measurement;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Color", "text", entCfg.color || "", (v) => {
        if (v) this._config.entities[idx].color = v; else delete this._config.entities[idx].color;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Min", "number", entCfg.min ?? "", (v) => {
        if (v !== "" && v !== null) this._config.entities[idx].min = Number(v); else delete this._config.entities[idx].min;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Max", "number", entCfg.max ?? "", (v) => {
        if (v !== "" && v !== null) this._config.entities[idx].max = Number(v); else delete this._config.entities[idx].max;
        this._fireConfigChanged();
      }));
      grid.appendChild(this._field("Target", "number", entCfg.target ?? "", (v) => {
        if (v !== "" && v !== null) this._config.entities[idx].target = Number(v); else delete this._config.entities[idx].target;
        this._fireConfigChanged();
      }));

      opts.appendChild(grid);

      const sevHint = document.createElement("div");
      sevHint.className = "hint";
      sevHint.textContent = "For severity rules, use the YAML editor.";
      opts.appendChild(sevHint);

      row.appendChild(opts);
    }

    return row;
  }

  // Remove empty zones object from config
  _cleanZones() {
    if (!this._config.zones) return;
    const hasThreshold = Object.keys(this._config.zones).some(
      (k) => k.includes("threshold") && this._config.zones[k] != null
    );
    const hasColor = Object.keys(this._config.zones).some(
      (k) => k.startsWith("color_") && this._config.zones[k]
    );
    if (!hasThreshold && !hasColor) delete this._config.zones;
  }

  // ─── Reusable editor widgets ───────────────────────────────────────────────

  _field(label, type, value, onChange) {
    const wrap = document.createElement("div"); wrap.className = "field";
    const lbl = document.createElement("label"); lbl.textContent = label; wrap.appendChild(lbl);
    const input = document.createElement("input");
    input.type = type; input.value = value ?? "";
    // Color inputs fire "input" continuously while picking; others use "change"
    const evt = type === "color" ? "input" : "change";
    input.addEventListener(evt, (e) => onChange(e.target.value));
    wrap.appendChild(input); return wrap;
  }

  _select(label, value, options, onChange) {
    const wrap = document.createElement("div"); wrap.className = "field";
    const lbl = document.createElement("label"); lbl.textContent = label; wrap.appendChild(lbl);
    const sel = document.createElement("select");
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.value; o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", (e) => onChange(e.target.value));
    wrap.appendChild(sel); return wrap;
  }

  _toggle(label, checked, onChange) {
    const wrap = document.createElement("div"); wrap.className = "field toggle-field";
    const lbl = document.createElement("label"); lbl.textContent = label; wrap.appendChild(lbl);
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = checked;
    cb.addEventListener("change", (e) => onChange(e.target.checked));
    wrap.appendChild(cb); return wrap;
  }

  // ─── Editor styles ─────────────────────────────────────────────────────────

  static _styles() {
    return /* css */ `
      :host { display: block; }
      .editor {
        display: flex; flex-direction: column; gap: 16px;
        padding: 16px 0;
        font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
        font-size: 14px; color: var(--primary-text-color);
      }
      .section {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px; padding: 12px;
      }
      .section-header {
        display: flex; align-items: center; justify-content: space-between;
        font-weight: 500; font-size: 15px; margin-bottom: 8px;
      }
      .section-header.clickable { cursor: pointer; user-select: none; }
      .section-body { margin-top: 8px; }
      .sub-label { font-weight: 500; font-size: 13px; margin: 12px 0 4px; opacity: 0.7; }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
      }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .field label { font-size: 12px; font-weight: 500; opacity: 0.7; }
      .field input, .field select {
        padding: 8px; border-radius: 6px;
        border: 1px solid var(--divider-color, #ccc);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 14px; font-family: inherit;
        outline: none; width: 100%; box-sizing: border-box;
      }
      .field input:focus, .field select:focus { border-color: var(--primary-color); }
      .toggle-field { flex-direction: row; align-items: center; gap: 8px; }
      .toggle-field input { width: auto; }
      input[type="color"] {
        height: 36px; padding: 2px; cursor: pointer;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        background: var(--card-background-color, #fff);
      }

      .entity-list {
        display: flex; flex-direction: column; gap: 4px;
        max-height: 500px; overflow-y: auto; margin-bottom: 8px;
      }
      .entity-row {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px; overflow: hidden;
      }
      .entity-main {
        display: flex; align-items: center; gap: 4px;
        padding: 4px 4px 4px 8px;
      }
      .entity-main ha-entity-picker { flex: 1; min-width: 0; }
      .entity-main ha-icon-button {
        --mdc-icon-button-size: 36px; --mdc-icon-size: 20px; flex-shrink: 0;
      }
      .entity-options {
        padding: 8px 12px 12px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
        background: var(--secondary-background-color, #f5f5f5);
      }
      .hint { font-size: 12px; opacity: 0.5; margin-top: 8px; font-style: italic; }

      ha-button { --mdc-theme-primary: var(--primary-color); align-self: flex-end; }
    `;
  }
}

customElements.define("bar-card-editor", BarCardEditor);


// ─── Card Picker Registration ────────────────────────────────────────────────

window.customCards = window.customCards || [];
window.customCards.push({
  type: "bar-card",
  name: "Bar Card Revamped",
  preview: true,
  description: "A customizable bar/gauge card for displaying entity values as horizontal or vertical bars. Revamped for modern Home Assistant.",
  documentationURL: "https://github.com/tmnyhbs/HABarCardRevamped",
});
