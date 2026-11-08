// Home Assistant Lovelace card. No build step.
// Reads tar1090 aircraft.json and receiver.json in the browser.

const DEFAULTS = {
    height: 460,
    poll_interval: 2,
    max_seen_pos: 60,
    latitude: null,
    longitude: null,
    title: "",
    show_map: true,
    map_opacity: 1,
    map_dim: 0.12,
    tile_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    attribution_url: "",
    show_attribution: true,
    show_status: true,
    show_rings: true,
    ring_count: 4,
    range_km: 2000,
    show_ring_labels: true,
    show_sweep: true,
    sweep_seconds: 6,
    sweep_width: 28,
    show_crosshair: false,
    show_origin: true,
    show_planes: true,
    show_callsign: true,
    show_hex: false,
    show_distance: true,
    show_speed: true,
    show_altitude: false,
    show_heading_line: true,
    show_ground: true,
    distance_unit: "km",
    speed_unit: "kmh",
    altitude_unit: "m",
    show_zoom_controls: true,
    show_reset: true,
    reset_after: 60,
    scroll_zoom: false,
    pan: true,
    auto_zoom: true,
    initial_zoom: 11,
    min_zoom: 4,
    max_zoom: 16,
    blip_size: 7,
    label_size: 12,
    plane_color: "#e7f36a",
    origin_color: "#ffb020",
    ring_color: "rgba(180, 255, 120, 0.55)",
    sweep_color: "rgba(180, 255, 120, 0.18)",
    label_color: "#f4f7f2",
    background: "#1b2420",
};

const BOOLEAN_KEYS = [
    "show_map",
    "show_attribution",
    "show_status",
    "show_rings",
    "show_ring_labels",
    "show_sweep",
    "show_crosshair",
    "show_origin",
    "show_planes",
    "show_callsign",
    "show_hex",
    "show_distance",
    "show_speed",
    "show_altitude",
    "show_heading_line",
    "show_ground",
    "show_zoom_controls",
    "show_reset",
    "scroll_zoom",
    "pan",
    "auto_zoom",
];

const NUMBER_KEYS = [
    "height",
    "poll_interval",
    "max_seen_pos",
    "latitude",
    "longitude",
    "map_opacity",
    "map_dim",
    "ring_count",
    "range_km",
    "sweep_seconds",
    "sweep_width",
    "reset_after",
    "initial_zoom",
    "min_zoom",
    "max_zoom",
    "blip_size",
    "label_size",
];

function isNum(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function parseDemoHome(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const lat = asNum(value.lat ?? value.latitude, null);
    const lng = asNum(value.lng ?? value.lon ?? value.longitude, null);
    if (!isNum(lat) || !isNum(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }
    return {lat, lng};
}

function asBool(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    if (typeof value === "string") {
        const text = value.trim().toLowerCase();
        if (["false", "no", "off", "0"].includes(text)) {
            return false;
        }
        if (["true", "yes", "on", "1"].includes(text)) {
            return true;
        }
    }
    return Boolean(value);
}

function asNum(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function mergeConfig(config) {
    const merged = {...DEFAULTS, ...config};
    merged.base_url = String(config.base_url || "").trim().replace(/\/+$/, "");
    if (!merged.base_url) {
        throw new Error("base_url is required, for example https://example.com/tar1090/data");
    }
    for (const key of BOOLEAN_KEYS) {
        merged[key] = asBool(config[key], DEFAULTS[key]);
    }
    for (const key of NUMBER_KEYS) {
        merged[key] = asNum(config[key], DEFAULTS[key]);
    }
    merged.poll_interval = Math.max(1, merged.poll_interval);
    merged.reset_after = Math.max(0, merged.reset_after);
    if (config.show_reset === undefined && config.show_recenter !== undefined) {
        merged.show_reset = asBool(config.show_recenter, DEFAULTS.show_reset);
    }
    merged.ring_count = Math.max(1, Math.round(merged.ring_count));
    merged.range_km = Math.max(1, merged.range_km);
    merged.min_zoom = Math.round(merged.min_zoom);
    merged.max_zoom = Math.round(merged.max_zoom);
    merged.initial_zoom = Math.round(merged.initial_zoom);
    if (merged.max_zoom < merged.min_zoom) {
        merged.max_zoom = merged.min_zoom;
    }
    merged.title = config.title == null ? "" : String(config.title);
    merged.attribution_url = config.attribution_url == null ? "" : String(config.attribution_url);
    merged.distance_unit = String(merged.distance_unit || "km").toLowerCase();
    merged.speed_unit = String(merged.speed_unit || "kmh").toLowerCase();
    merged.altitude_unit = String(merged.altitude_unit || "m").toLowerCase();
    // See docs/demo-home.md. Not listed in the README.
    merged.demo_home = parseDemoHome(config.demo_home);
    return merged;
}

function clampZoom(config, zoom) {
    const value = Number.isFinite(zoom) ? zoom : config.initial_zoom;
    return Math.max(config.min_zoom, Math.min(config.max_zoom, value));
}

function fitZoom(config, origin, aircraft, width, height) {
    if (!aircraft.length) {
        return clampZoom(config, config.initial_zoom);
    }
    const pad = 36;
    const halfW = width / 2 - pad;
    const halfH = height / 2 - pad;
    if (halfW < 8 || halfH < 8) {
        return config.min_zoom;
    }
    const originPoint = project(origin.lat, origin.lon, 0);
    let zoom = config.max_zoom;
    for (const plane of aircraft) {
        const point = project(plane.lat, plane.lon, 0);
        const dx = Math.abs(point.x - originPoint.x);
        const dy = Math.abs(point.y - originPoint.y);
        let planeZoom = config.max_zoom;
        if (dx > 0) {
            planeZoom = Math.min(planeZoom, Math.log2(halfW / dx));
        }
        if (dy > 0) {
            planeZoom = Math.min(planeZoom, Math.log2(halfH / dy));
        }
        zoom = Math.min(zoom, planeZoom);
    }
    return clampZoom(config, zoom);
}

function rectsOverlap(a, b, gap = 4) {
    return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

function labelAnchorOffsets(box, blip) {
    const margin = blip + 4;
    return [
        {x: margin, y: -box.h / 2},
        {x: -box.w - margin, y: -box.h / 2},
        {x: -box.w / 2, y: -box.h - margin},
        {x: -box.w / 2, y: margin},
        {x: margin, y: -box.h - margin},
        {x: -box.w - margin, y: -box.h - margin},
        {x: margin, y: 2},
        {x: -box.w - margin, y: 2},
    ];
}

function chooseLabelRect(screen, box, blip, bounds, obstacles) {
    const rects = labelAnchorOffsets(box, blip).map((anchor) => ({
        x: screen.x + anchor.x,
        y: screen.y + anchor.y,
        w: box.w,
        h: box.h,
    }));
    const inside = (rect) => rect.x >= bounds.x && rect.y >= bounds.y
        && rect.x + rect.w <= bounds.x + bounds.w
        && rect.y + rect.h <= bounds.y + bounds.h;
    const clear = (rect) => obstacles.every((obstacle) => !rectsOverlap(rect, obstacle));
    return rects.find((rect) => inside(rect) && clear(rect))
        || rects.find((rect) => clear(rect))
        || null;
}

function niceRingDistances(outerKm, count) {
    const safeOuter = Math.max(Number(outerKm) || 0, 0.05);
    const safeCount = Math.max(1, Math.round(count) || 1);
    const raw = safeOuter / safeCount;
    const pow = 10 ** Math.floor(Math.log10(raw));
    let best = null;
    for (const mult of [0.5, 1, 2, 2.5, 5, 10]) {
        const step = mult * pow;
        const n = Math.min(safeCount, Math.floor((safeOuter + step * 1e-6) / step));
        if (n < 1) {
            continue;
        }
        const coverage = (n * step) / safeOuter;
        const score = Math.abs(safeCount - n) * 0.15 + (1 - coverage);
        if (!best || score < best.score) {
            best = {step, n, score};
        }
    }
    if (!best) {
        return [safeOuter];
    }
    const rings = [];
    for (let index = 1; index <= best.n; index += 1) {
        rings.push(best.step * index);
    }
    return rings;
}

function formatRingDistance(km, unit) {
    let value = km;
    let suffix = "km";
    if (unit === "nmi" || unit === "nm") {
        value = km / 1.852;
        suffix = "nmi";
    } else if (unit === "mi") {
        value = km / 1.609344;
        suffix = "mi";
    }
    const abs = Math.abs(value);
    const digits = abs >= 10 ? 0 : abs >= 1 ? 1 : 2;
    const text = value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return `${text} ${suffix}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const radius = 6371;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function initialBearing(lat1, lon1, lat2, lon2) {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180) / Math.PI;
}

function shiftToDemoHome(aircraft, real, demo) {
    return aircraft.map((plane) => {
        const km = haversineKm(real.lat, real.lon, plane.lat, plane.lon);
        if (km < 0.001) {
            return {...plane, lat: demo.lat, lon: demo.lng};
        }
        const point = destination(demo.lat, demo.lng, km, initialBearing(real.lat, real.lon, plane.lat, plane.lon));
        return {...plane, lat: point.lat, lon: point.lon};
    });
}

function destination(lat, lon, distanceKm, bearingDeg) {
    const radius = 6371;
    const delta = distanceKm / radius;
    const theta = (bearingDeg * Math.PI) / 180;
    const phi1 = (lat * Math.PI) / 180;
    const lambda1 = (lon * Math.PI) / 180;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
    const lambda2 = lambda1 + Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
    let lon2 = (lambda2 * 180) / Math.PI;
    lon2 = ((lon2 + 540) % 360) - 180;
    return {lat: (phi2 * 180) / Math.PI, lon: lon2};
}

function project(lat, lon, zoom) {
    const size = 256 * 2 ** zoom;
    const sin = Math.sin((lat * Math.PI) / 180);
    const clamped = Math.min(Math.max(sin, -0.9999), 0.9999);
    return {
        x: ((lon + 180) / 360) * size,
        y: (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * size,
    };
}

function unproject(x, y, zoom) {
    const size = 256 * 2 ** zoom;
    const lon = (x / size) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / size))) * 180) / Math.PI;
    return {lat, lon};
}

function planeDistanceKm(aircraft, origin) {
    if (!origin) {
        return null;
    }
    if (isNum(aircraft.r_dst) && aircraft.r_dst >= 0) {
        return aircraft.r_dst * 1.852;
    }
    return haversineKm(origin.lat, origin.lon, aircraft.lat, aircraft.lon);
}

function formatDistance(km, unit) {
    if (!isNum(km)) {
        return "";
    }
    let value = km;
    let suffix = "km";
    if (unit === "nmi" || unit === "nm") {
        value = km / 1.852;
        suffix = "nmi";
    } else if (unit === "mi") {
        value = km / 1.609344;
        suffix = "mi";
    }
    const digits = value >= 100 ? 0 : 1;
    return `${value.toFixed(digits)} ${suffix}`;
}

function formatSpeed(knots, unit) {
    if (!isNum(knots)) {
        return "";
    }
    let value = knots;
    let suffix = "kt";
    if (unit === "kmh" || unit === "km/h") {
        value = knots * 1.852;
        suffix = "km/h";
    } else if (unit === "mph") {
        value = knots * 1.15078;
        suffix = "mph";
    }
    return `${Math.round(value)} ${suffix}`;
}

function formatAltitude(aircraft, unit) {
    if (aircraft.alt_baro === "ground") {
        return "ground";
    }
    if (!isNum(aircraft.alt_baro)) {
        return "";
    }
    if (unit === "m") {
        return `${Math.round(aircraft.alt_baro * 0.3048)} m`;
    }
    return `${Math.round(aircraft.alt_baro)} ft`;
}

function usesOsmTiles(url) {
    return /(^|\/\/)tile\.openstreetmap\.org\//i.test(String(url || ""));
}

function visibleAircraft(doc, config) {
    const list = Array.isArray(doc?.aircraft) ? doc.aircraft : [];
    return list.filter((aircraft) => {
        if (!isNum(aircraft.lat) || !isNum(aircraft.lon)) {
            return false;
        }
        if (!config.show_ground && aircraft.alt_baro === "ground") {
            return false;
        }
        if (config.max_seen_pos > 0 && isNum(aircraft.seen_pos) && aircraft.seen_pos > config.max_seen_pos) {
            return false;
        }
        return true;
    });
}

class Tar1090RadarCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: "open"});
        this._config = null;
        this._zoom = null;
        this._center = null;
        this._origin = null;
        this._realOrigin = null;
        this._aircraft = [];
        this._error = "";
        this._userMoved = false;
        this._idleTimer = 0;
        this._drag = null;
        this._tiles = new Map();
        this._timer = 0;
        this._raf = 0;
        this._width = 0;
        this._height = 0;
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                ha-card { overflow: hidden; }
                .frame {
                    position: relative;
                    height: 460px;
                    background: #1b2420;
                    touch-action: none;
                    user-select: none;
                }
                canvas { display: block; width: 100%; height: 100%; }
                .controls {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                button {
                    width: 36px;
                    height: 36px;
                    padding: 0;
                    border: 0;
                    border-radius: 8px;
                    background: rgba(12, 18, 16, 0.78);
                    color: #f4f7f2;
                    font-size: 20px;
                    line-height: 36px;
                    cursor: pointer;
                }
                button[hidden] { display: none; }
                .status, .attribution {
                    position: absolute;
                    color: #f4f7f2;
                    font: 600 12px sans-serif;
                    text-shadow: 0 1px 2px #000;
                    pointer-events: none;
                }
                .status { left: 10px; bottom: 22px; max-width: 70%; }
                .attribution { right: 8px; bottom: 4px; font-weight: 500; opacity: 0.85; pointer-events: auto; }
                .attribution a { color: inherit; }
            </style>
            <ha-card>
                <div class="frame">
                    <canvas></canvas>
                    <div class="controls">
                        <button type="button" data-action="in" aria-label="Zoom in">+</button>
                        <button type="button" data-action="out" aria-label="Zoom out">−</button>
                        <button type="button" data-action="reset" aria-label="Reset view">↺</button>
                    </div>
                    <div class="status"></div>
                    <div class="attribution"></div>
                </div>
            </ha-card>
        `;
        this._frame = this.shadowRoot.querySelector(".frame");
        this._canvas = this.shadowRoot.querySelector("canvas");
        this._ctx = this._canvas.getContext("2d");
        this._status = this.shadowRoot.querySelector(".status");
        this._attribution = this.shadowRoot.querySelector(".attribution");
        this._card = this.shadowRoot.querySelector("ha-card");
        this._buttons = {
            in: this.shadowRoot.querySelector("[data-action=in]"),
            out: this.shadowRoot.querySelector("[data-action=out]"),
            reset: this.shadowRoot.querySelector("[data-action=reset]"),
        };
        this._buttons.in.addEventListener("click", () => this._stepZoom(1));
        this._buttons.out.addEventListener("click", () => this._stepZoom(-1));
        this._buttons.reset.addEventListener("click", () => this._resetView());
        this._frame.addEventListener("pointerdown", (event) => this._pointerDown(event));
        this._frame.addEventListener("pointermove", (event) => this._pointerMove(event));
        this._frame.addEventListener("pointerup", (event) => this._pointerUp(event));
        this._frame.addEventListener("pointercancel", (event) => this._pointerUp(event));
        this._frame.addEventListener("wheel", (event) => this._wheel(event), {passive: false});
    }

    static getStubConfig() {
        return {
            base_url: "https://example.com/tar1090/data",
            height: 460,
        };
    }

    setConfig(config) {
        this._config = mergeConfig(config || {});
        if (this._zoom == null) {
            this._zoom = clampZoom(this._config, this._config.initial_zoom);
        } else {
            this._zoom = clampZoom(this._config, this._zoom);
        }
        this._applyChrome();
        if (this.isConnected) {
            this._start();
        }
    }

    set hass(hass) {
        this._hass = hass;
    }

    getCardSize() {
        const height = this._config?.height ?? DEFAULTS.height;
        return Math.max(1, Math.ceil(height / 50));
    }

    connectedCallback() {
        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(this._frame);
        this._resize();
        if (this._config) {
            this._start();
        }
    }

    disconnectedCallback() {
        this._resizeObserver?.disconnect();
        this._stop();
    }

    _applyChrome() {
        const config = this._config;
        this._frame.style.height = `${config.height}px`;
        this._frame.style.background = config.background;
        this._frame.style.touchAction = config.pan ? "none" : "auto";
        this._card.header = config.title;
        this._buttons.in.hidden = !config.show_zoom_controls;
        this._buttons.out.hidden = !config.show_zoom_controls;
        this._buttons.reset.hidden = !config.show_reset;
        const osmTiles = usesOsmTiles(config.tile_url);
        const showAttribution = config.show_map && (config.show_attribution || osmTiles);
        this._attribution.hidden = !showAttribution;
        this._attribution.replaceChildren();
        if (showAttribution) {
            const creditUrl = config.attribution_url || (osmTiles ? "https://www.openstreetmap.org/copyright" : "");
            if (creditUrl) {
                const link = document.createElement("a");
                link.href = creditUrl;
                link.target = "_blank";
                link.rel = "noopener";
                link.textContent = config.attribution;
                this._attribution.appendChild(link);
            } else {
                this._attribution.textContent = config.attribution;
            }
        }
        this._status.hidden = !config.show_status;
        this._armSweep();
    }

    _start() {
        this._stop();
        const tick = () => {
            this._poll();
        };
        tick();
        this._timer = window.setInterval(tick, this._config.poll_interval * 1000);
        this._armSweep();
    }

    _stop() {
        if (this._timer) {
            window.clearInterval(this._timer);
            this._timer = 0;
        }
        if (this._idleTimer) {
            window.clearTimeout(this._idleTimer);
            this._idleTimer = 0;
        }
        if (this._raf) {
            window.cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
    }

    _armSweep() {
        if (this._raf) {
            window.cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!this.isConnected || !this._config?.show_sweep || reduced) {
            this._draw();
            return;
        }
        const loop = () => {
            this._draw();
            this._raf = window.requestAnimationFrame(loop);
        };
        this._raf = window.requestAnimationFrame(loop);
    }

    async _poll() {
        const config = this._config;
        if (!config) {
            return;
        }
        const [aircraftResult, receiverResult] = await Promise.allSettled([
            fetch(`${config.base_url}/aircraft.json`, {cache: "no-store"}),
            fetch(`${config.base_url}/receiver.json`, {cache: "no-store"}),
        ]);
        if (aircraftResult.status === "fulfilled" && aircraftResult.value.ok) {
            try {
                const doc = await aircraftResult.value.json();
                this._aircraft = visibleAircraft(doc, config);
                this._error = "";
            } catch (err) {
                this._error = "aircraft.json was not valid JSON";
            }
        } else {
            const status = aircraftResult.status === "fulfilled" ? aircraftResult.value.status : "network";
            this._error = `aircraft.json failed (${status})`;
        }
        let real = null;
        if (receiverResult.status === "fulfilled" && receiverResult.value.ok) {
            try {
                const receiver = await receiverResult.value.json();
                if (isNum(receiver.lat) && isNum(receiver.lon)) {
                    real = {lat: receiver.lat, lon: receiver.lon};
                }
            } catch (err) {
                // Keep the last real origin. Aircraft can still be drawn.
            }
        }
        if (!real && isNum(config.latitude) && isNum(config.longitude)) {
            real = {lat: config.latitude, lon: config.longitude};
        }
        if (!real) {
            real = this._realOrigin;
        }
        if (real) {
            this._realOrigin = real;
        }
        if (real && config.demo_home) {
            this._origin = {lat: config.demo_home.lat, lon: config.demo_home.lng};
            this._aircraft = shiftToDemoHome(this._aircraft, real, config.demo_home);
        } else if (real) {
            this._origin = real;
        }
        this._maybeAutocenter();
        this._applyAutoZoom();
        this._updateStatus();
        if (!this._raf) {
            this._draw();
        }
    }

    _updateStatus() {
        if (!this._config?.show_status) {
            this._status.textContent = "";
            return;
        }
        if (this._error) {
            this._status.textContent = this._error;
            return;
        }
        const count = this._aircraft.length;
        this._status.textContent = count === 1 ? "1 aircraft" : `${count} aircraft`;
    }

    _maybeAutocenter() {
        if (this._userMoved) {
            return;
        }
        if (this._origin) {
            this._center = {lat: this._origin.lat, lon: this._origin.lon};
            return;
        }
        if (this._config?.demo_home) {
            return;
        }
        if (!this._center && this._aircraft.length) {
            this._center = {lat: this._aircraft[0].lat, lon: this._aircraft[0].lon};
        }
    }

    _resize() {
        const rect = this._frame.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this._width = Math.max(1, rect.width);
        this._height = Math.max(1, rect.height);
        this._canvas.width = Math.floor(this._width * dpr);
        this._canvas.height = Math.floor(this._height * dpr);
        this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._applyAutoZoom();
        this._draw();
    }

    _applyAutoZoom() {
        const config = this._config;
        if (!config?.auto_zoom || this._userMoved || !this._origin || this._width < 2 || this._height < 2) {
            return;
        }
        this._zoom = fitZoom(config, this._origin, this._aircraft, this._width, this._height);
    }

    _toScreen(lat, lon) {
        const zoom = this._zoom;
        const point = project(lat, lon, zoom);
        const center = project(this._center.lat, this._center.lon, zoom);
        return {
            x: this._width / 2 + (point.x - center.x),
            y: this._height / 2 + (point.y - center.y),
        };
    }

    _stepZoom(direction) {
        const current = this._zoom ?? this._config?.initial_zoom ?? 11;
        const next = direction > 0 ? Math.floor(current) + 1 : Math.ceil(current) - 1;
        this._setZoom(next);
    }

    _setZoom(zoom) {
        if (!this._config) {
            return;
        }
        this._userMoved = true;
        this._zoom = clampZoom(this._config, Math.round(zoom));
        this._noteActivity();
        this._draw();
    }

    _resetView() {
        if (!this._config) {
            return;
        }
        if (this._idleTimer) {
            window.clearTimeout(this._idleTimer);
            this._idleTimer = 0;
        }
        this._userMoved = false;
        this._zoom = clampZoom(this._config, this._config.initial_zoom);
        if (this._origin) {
            this._center = {lat: this._origin.lat, lon: this._origin.lon};
        }
        this._applyAutoZoom();
        this._draw();
    }

    _noteActivity() {
        const seconds = this._config?.reset_after ?? 0;
        if (seconds <= 0) {
            return;
        }
        if (this._idleTimer) {
            window.clearTimeout(this._idleTimer);
        }
        this._idleTimer = window.setTimeout(() => this._resetView(), seconds * 1000);
    }

    _pointerDown(event) {
        if (event.target.closest("button, a")) {
            return;
        }
        this._noteActivity();
        if (!this._config?.pan || !this._center) {
            return;
        }
        this._drag = {
            x: event.clientX,
            y: event.clientY,
            lat: this._center.lat,
            lon: this._center.lon,
            moved: false,
        };
        this._frame.setPointerCapture(event.pointerId);
    }

    _pointerMove(event) {
        if (!this._drag) {
            return;
        }
        const dx = event.clientX - this._drag.x;
        const dy = event.clientY - this._drag.y;
        if (!this._drag.moved && Math.hypot(dx, dy) < 4) {
            return;
        }
        this._drag.moved = true;
        this._userMoved = true;
        const start = project(this._drag.lat, this._drag.lon, this._zoom);
        this._center = unproject(start.x - dx, start.y - dy, this._zoom);
        this._draw();
    }

    _pointerUp(event) {
        if (this._frame.hasPointerCapture(event.pointerId)) {
            this._frame.releasePointerCapture(event.pointerId);
        }
        this._drag = null;
    }

    _wheel(event) {
        if (!this._config?.scroll_zoom) {
            return;
        }
        event.preventDefault();
        this._stepZoom(event.deltaY < 0 ? 1 : -1);
    }

    _tile(zoom, x, y) {
        const world = 2 ** zoom;
        if (y < 0 || y >= world) {
            return null;
        }
        const wrapped = ((x % world) + world) % world;
        const key = `${zoom}/${wrapped}/${y}`;
        let image = this._tiles.get(key);
        if (!image) {
            image = new Image();
            // OSM requires a Referer on web tile requests. Home Assistant pages often
            // set Referrer-Policy to drop it, which tile.openstreetmap.org answers with 403.
            image.referrerPolicy = "strict-origin-when-cross-origin";
            image.onload = () => this._draw();
            image.src = this._config.tile_url
                .split("{z}").join(String(zoom))
                .split("{x}").join(String(wrapped))
                .split("{y}").join(String(y));
            this._tiles.set(key, image);
            while (this._tiles.size > 180) {
                const oldest = this._tiles.keys().next().value;
                this._tiles.delete(oldest);
            }
        }
        return image;
    }

    _draw() {
        const config = this._config;
        const ctx = this._ctx;
        if (!config || !this._center || this._width < 2 || this._height < 2) {
            return;
        }
        ctx.clearRect(0, 0, this._width, this._height);
        ctx.fillStyle = config.background;
        ctx.fillRect(0, 0, this._width, this._height);
        if (config.show_map) {
            this._drawTiles();
            if (config.map_dim > 0) {
                ctx.fillStyle = `rgba(0, 0, 0, ${config.map_dim})`;
                ctx.fillRect(0, 0, this._width, this._height);
            }
        }
        if (this._origin && config.show_rings) {
            this._drawRings();
        }
        if (this._origin && config.show_sweep && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            this._drawSweep();
        }
        if (this._origin && config.show_crosshair) {
            this._drawCrosshair();
        }
        if (this._origin && config.show_rings) {
            this._drawRingLabels();
        }
        if (this._origin && config.show_origin) {
            this._drawOrigin();
        }
        if (config.show_planes) {
            this._drawPlanes();
        }
    }

    _drawTiles() {
        const ctx = this._ctx;
        const zoom = this._zoom;
        const tileZoom = Math.round(clampZoom(this._config, zoom));
        const tileSize = 256 * 2 ** (zoom - tileZoom);
        const center = project(this._center.lat, this._center.lon, zoom);
        const left = center.x - this._width / 2;
        const top = center.y - this._height / 2;
        const x0 = Math.floor(left / tileSize);
        const x1 = Math.floor((left + this._width) / tileSize);
        const y0 = Math.floor(top / tileSize);
        const y1 = Math.floor((top + this._height) / tileSize);
        ctx.save();
        ctx.globalAlpha = this._config.map_opacity;
        for (let tileY = y0; tileY <= y1; tileY += 1) {
            for (let tileX = x0; tileX <= x1; tileX += 1) {
                const image = this._tile(tileZoom, tileX, tileY);
                if (!image || !image.complete || !image.naturalWidth) {
                    continue;
                }
                ctx.drawImage(image, tileX * tileSize - left, tileY * tileSize - top, tileSize + 0.5, tileSize + 0.5);
            }
        }
        ctx.restore();
    }

    _kmPerPixel() {
        const east = destination(this._origin.lat, this._origin.lon, 1, 90);
        const origin = this._toScreen(this._origin.lat, this._origin.lon);
        const point = this._toScreen(east.lat, east.lon);
        return 1 / Math.max(Math.hypot(point.x - origin.x, point.y - origin.y), 0.001);
    }

    _ringDistances() {
        const config = this._config;
        const radiusPx = Math.max(48, Math.min(this._width, this._height) * 0.42);
        const fitted = radiusPx * this._kmPerPixel();
        const outerKm = Math.min(fitted, Math.max(0.1, config.range_km));
        return niceRingDistances(outerKm, config.ring_count);
    }

    _drawRings() {
        const config = this._config;
        const ctx = this._ctx;
        const distances = this._ringDistances();
        ctx.save();
        ctx.strokeStyle = config.ring_color;
        ctx.lineWidth = 1;
        for (const km of distances) {
            ctx.beginPath();
            for (let bearing = 0; bearing <= 360; bearing += 6) {
                const point = destination(this._origin.lat, this._origin.lon, km, bearing);
                const screen = this._toScreen(point.lat, point.lon);
                if (bearing === 0) {
                    ctx.moveTo(screen.x, screen.y);
                } else {
                    ctx.lineTo(screen.x, screen.y);
                }
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawRingLabels() {
        if (!this._config.show_ring_labels) {
            return;
        }
        for (const km of this._ringDistances()) {
            this._drawRingLabel(km);
        }
    }

    _drawRingLabel(km) {
        const config = this._config;
        const ctx = this._ctx;
        const origin = this._toScreen(this._origin.lat, this._origin.lon);
        let anchor = null;
        for (let bearing = 0; bearing < 360; bearing += 15) {
            const geo = destination(this._origin.lat, this._origin.lon, km, bearing);
            const screen = this._toScreen(geo.lat, geo.lon);
            if (screen.x < 28 || screen.y < 16 || screen.x > this._width - 28 || screen.y > this._height - 12) {
                continue;
            }
            const radius = Math.hypot(screen.x - origin.x, screen.y - origin.y);
            if (radius < 22) {
                continue;
            }
            if (!anchor || screen.y < anchor.screen.y) {
                anchor = {screen, radius};
            }
        }
        if (!anchor) {
            return;
        }
        const dx = anchor.screen.x - origin.x;
        const dy = anchor.screen.y - origin.y;
        const scale = 10 / anchor.radius;
        const x = anchor.screen.x - dx * scale;
        const y = anchor.screen.y - dy * scale;
        const text = formatRingDistance(km, config.distance_unit);
        ctx.save();
        ctx.font = `500 ${Math.max(11, config.label_size - 1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillStyle = "rgba(244, 247, 242, 0.5)";
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    _drawSweep() {
        const config = this._config;
        const origin = this._toScreen(this._origin.lat, this._origin.lon);
        const distances = this._ringDistances();
        const outerKm = distances.length ? distances[distances.length - 1] : config.range_km;
        const edge = destination(this._origin.lat, this._origin.lon, outerKm, 90);
        const edgeScreen = this._toScreen(edge.lat, edge.lon);
        const radius = Math.max(1, Math.hypot(edgeScreen.x - origin.x, edgeScreen.y - origin.y));
        const angle = ((performance.now() / 1000) / Math.max(0.5, config.sweep_seconds)) * Math.PI * 2;
        const half = (config.sweep_width * Math.PI) / 360;
        const ctx = this._ctx;
        ctx.save();
        ctx.translate(origin.x, origin.y);
        ctx.rotate(angle - Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, -half, half);
        ctx.closePath();
        ctx.fillStyle = config.sweep_color;
        ctx.fill();
        ctx.restore();
    }

    _drawCrosshair() {
        const origin = this._toScreen(this._origin.lat, this._origin.lon);
        const ctx = this._ctx;
        ctx.save();
        ctx.strokeStyle = this._config.ring_color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, this._height);
        ctx.moveTo(0, origin.y);
        ctx.lineTo(this._width, origin.y);
        ctx.stroke();
        ctx.restore();
    }

    _drawOrigin() {
        const config = this._config;
        const screen = this._toScreen(this._origin.lat, this._origin.lon);
        const ctx = this._ctx;
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.fillStyle = config.origin_color;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(9, 0);
        ctx.moveTo(0, -9);
        ctx.lineTo(0, 9);
        ctx.stroke();
        ctx.restore();
    }

    _drawPlanes() {
        const config = this._config;
        const pad = 48;
        const visible = [];
        for (const aircraft of this._aircraft) {
            const screen = this._toScreen(aircraft.lat, aircraft.lon);
            if (screen.x < -pad || screen.y < -pad || screen.x > this._width + pad || screen.y > this._height + pad) {
                continue;
            }
            visible.push({aircraft, screen});
            const track = isNum(aircraft.track) ? aircraft.track : (isNum(aircraft.true_heading) ? aircraft.true_heading : null);
            this._drawBlip(screen.x, screen.y, track, aircraft.gs);
        }
        visible.sort((a, b) => a.screen.y - b.screen.y || a.screen.x - b.screen.x);
        const obstacles = visible.map((item) => ({
            x: item.screen.x - config.blip_size,
            y: item.screen.y - config.blip_size,
            w: config.blip_size * 2,
            h: config.blip_size * 2,
        }));
        if (this._origin && config.show_origin) {
            const origin = this._toScreen(this._origin.lat, this._origin.lon);
            obstacles.push({x: origin.x - 14, y: origin.y - 14, w: 28, h: 28});
        }
        const bounds = {x: 4, y: 4, w: Math.max(0, this._width - 8), h: Math.max(0, this._height - 8)};
        const placed = [];
        for (const item of visible) {
            let chosen = null;
            let lines = null;
            for (const candidate of this._planeLabelLevels(item.aircraft)) {
                const rect = chooseLabelRect(
                    item.screen,
                    this._labelBox(candidate),
                    config.blip_size,
                    bounds,
                    obstacles.concat(placed),
                );
                if (rect) {
                    chosen = rect;
                    lines = candidate;
                    break;
                }
            }
            if (!chosen) {
                continue;
            }
            placed.push(chosen);
            this._drawLabel(chosen.x, chosen.y, lines);
        }
    }

    _labelBox(lines) {
        const size = this._config.label_size;
        this._ctx.font = `600 ${size}px sans-serif`;
        const text = Math.max(...lines.map((line) => this._ctx.measureText(line).width), 0);
        return {w: text + 10, h: lines.length * (size + 2) + 6};
    }

    _planeLabelLevels(aircraft) {
        const full = this._planeLines(aircraft);
        if (!full.length) {
            return [];
        }
        const levels = [full];
        const push = (lines) => {
            const key = lines.join("\n");
            if (!levels.some((existing) => existing.join("\n") === key)) {
                levels.push(lines);
            }
        };
        if (full.length > 1) {
            push([full[0]]);
        }
        const detail = full[full.length - 1];
        const head = detail.split(" · ")[0];
        if (head && head !== detail) {
            push([head]);
        }
        return levels;
    }

    _planeLines(aircraft) {
        const config = this._config;
        const lines = [];
        const name = String(aircraft.flight || "").trim();
        if (config.show_callsign && name) {
            lines.push(name);
        } else if (config.show_hex && aircraft.hex) {
            lines.push(String(aircraft.hex));
        }
        const details = [];
        if (config.show_speed) {
            const speed = formatSpeed(isNum(aircraft.gs) ? aircraft.gs : null, config.speed_unit);
            if (speed) {
                details.push(speed);
            }
        }
        if (config.show_distance) {
            const distance = formatDistance(planeDistanceKm(aircraft, this._origin), config.distance_unit);
            if (distance) {
                details.push(distance);
            }
        }
        if (config.show_altitude) {
            const altitude = formatAltitude(aircraft, config.altitude_unit);
            if (altitude) {
                details.push(altitude);
            }
        }
        if (details.length) {
            lines.push(details.join(" · "));
        }
        return lines;
    }

    _drawBlip(x, y, track, knots) {
        const config = this._config;
        const ctx = this._ctx;
        const size = config.blip_size;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = config.plane_color;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.lineWidth = 1;
        if (config.show_heading_line && track != null) {
            const length = 12 + Math.min(isNum(knots) ? knots : 0, 500) / 25;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.sin((track * Math.PI) / 180) * length, -Math.cos((track * Math.PI) / 180) * length);
            ctx.strokeStyle = config.plane_color;
            ctx.stroke();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        }
        if (track == null) {
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.rotate((track * Math.PI) / 180);
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.72, size * 0.75);
            ctx.lineTo(-size * 0.72, size * 0.75);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawLabel(x, y, lines) {
        const config = this._config;
        const ctx = this._ctx;
        const size = config.label_size;
        ctx.save();
        ctx.font = `600 ${size}px sans-serif`;
        const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
        const height = lines.length * (size + 2);
        ctx.fillStyle = "rgba(12, 18, 16, 0.75)";
        ctx.fillRect(x, y, width + 10, height + 6);
        ctx.fillStyle = config.label_color;
        lines.forEach((line, index) => {
            ctx.fillText(line, x + 5, y + size + 1 + index * (size + 2));
        });
        ctx.restore();
    }
}

if (!customElements.get("tar1090-radar-card")) {
    customElements.define("tar1090-radar-card", Tar1090RadarCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "tar1090-radar-card")) {
    window.customCards.push({
        type: "tar1090-radar-card",
        name: "tar1090 Radar",
        description: "Map with a radar overlay of aircraft from tar1090",
    });
}
