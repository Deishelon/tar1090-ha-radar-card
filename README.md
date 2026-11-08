# tar1090 radar card

A Home Assistant dashboard card. It draws a normal map, then a radar overlay on top: range rings, your receiver, and
each aircraft from tar1090. Drag to pan. The origin stays on its real position while the map moves. Zoom with the +
and − buttons.

By default the card zooms to the furthest aircraft and follows it as the aircraft move. A plane that starts far away
zooms the map out only far enough to keep that plane on screen. As it comes closer, the map zooms back in. That stops
while you pan or zoom, and starts again after ↺ or the idle reset. `auto_zoom: false` keeps `initial_zoom` until you
change it yourself.

Aircraft labels move around the icon when they would cover each other. If there is still no gap, the label drops to
the callsign, or to the speed alone.

Each range ring has a faint distance on it. The distances follow the zoom: closer when you zoom in, farther when you
zoom out. The rings stay about the same size on the card. `range_km` is the furthest the outer ring is allowed to grow.

The card reads `aircraft.json` and `receiver.json` in your browser. It does not use the MQTT bridge. The bridge still
publishes the summary sensors. This card plots every aircraft.

Your tar1090 data URL already sends `Access-Control-Allow-Origin: *`, so a browser on another host can read it.

## Install

Copy `tar1090-radar-card.js` into Home Assistant's `www` folder:

```text
config/www/tar1090-radar-card/tar1090-radar-card.js
```

On Home Assistant OS that folder is `/config/www`. It is served as `/local/`.

Add a Lovelace resource. Settings → Dashboards → three dots → Resources → Add resource:

- URL: `/local/tar1090-radar-card/tar1090-radar-card.js?v=1`
- Type: JavaScript module

Reload the dashboard. Add a card with YAML. There is no visual editor.

```yaml
type: custom:tar1090-radar-card
base_url: https://plane.home.deishelon.com/map/data
height: 460
```

After you change the JavaScript file, increase `?v=1` to `?v=2` so the browser fetches the new file.

The browser must be able to reach `base_url`. A phone on your LAN can. A remote Home Assistant session can only if that
URL is reachable from the phone.

## Example

Distance labels off, speed and callsign on, rings never larger than 80 km, wheel zoom enabled:

```yaml
type: custom:tar1090-radar-card
base_url: https://plane.home.deishelon.com/map/data
height: 520
show_distance: false
show_speed: true
show_callsign: true
show_altitude: true
range_km: 80
ring_count: 4
scroll_zoom: true
```

Pure radar, no street map:

```yaml
type: custom:tar1090-radar-card
base_url: https://plane.home.deishelon.com/map/data
show_map: false
show_sweep: true
show_crosshair: true
```

## Receiver position

The origin is `lat` and `lon` from `receiver.json`. The card uses that when the file has a position.

`latitude` and `longitude` in the card YAML are used only when `receiver.json` has no position. They do not override the
API.

Aircraft distance uses readsb `r_dst` when the aircraft has it (nautical miles, converted into the unit you chose).
Otherwise the card measures the great-circle distance from the origin. Bearing of the nose is `track`, then
`true_heading`.

## Configuration

Unquoted `false` and `true` in YAML are booleans. `base_url` is required. Every other key is optional.

| Key                  | Default                     | What it does                                                                                          |
|----------------------|-----------------------------|-------------------------------------------------------------------------------------------------------|
| `base_url`           |                             | Directory that contains `aircraft.json` and `receiver.json`. No trailing filename.                    |
| `title`              | empty                       | Card header. Leave empty for no header.                                                               |
| `height`             | `460`                       | Card height in pixels.                                                                                |
| `poll_interval`      | `2`                         | Seconds between fetches. Minimum 1.                                                                   |
| `max_seen_pos`       | `60`                        | Hide an aircraft whose position is older than this many seconds. `0` keeps every positioned aircraft. |
| `latitude`           |                             | Fallback receiver latitude. Used only when `receiver.json` has no position.                           |
| `longitude`          |                             | Fallback receiver longitude. Same rule as `latitude`.                                                 |
| `show_map`           | `true`                      | Draw the street map under the radar.                                                                  |
| `map_opacity`        | `1`                         | Map tile opacity from 0 to 1.                                                                         |
| `map_dim`            | `0.12`                      | Black veil over the map so rings and aircraft stay readable. `0` turns it off.                        |
| `tile_url`           | `tile.openstreetmap.org`    | Tile template. `{z}`, `{x}`, and `{y}` are replaced, in whatever order the server uses.               |
| `attribution`        | `© OpenStreetMap contributors` | Text in the corner. Change this if you change `tile_url`.                                          |
| `attribution_url`    | OSM copyright page for OSM tiles | Link on the attribution text. Empty for other tile servers unless you set one.                    |
| `show_attribution`   | `true`                      | Show the attribution line. OSM tiles keep the credit visible even if this is `false`.               |
| `show_status`        | `true`                      | Show the aircraft count, or the fetch error.                                                          |
| `show_rings`         | `true`                      | Range rings around the origin.                                                                        |
| `ring_count`         | `4`                         | How many range rings to draw around the receiver.                                                     |
| `range_km`           | `2000`                      | Furthest outer ring, in kilometres. Zooming in uses a smaller distance so the rings stay on the card. |
| `show_ring_labels`   | `true`                      | Faint distance on each ring, in `distance_unit`. The numbers change as you zoom.                      |
| `show_sweep`         | `true`                      | Rotating radar wedge. Off when the browser asks for reduced motion.                                   |
| `sweep_seconds`      | `6`                         | Seconds for one full rotation.                                                                        |
| `sweep_width`        | `28`                        | Wedge width in degrees.                                                                               |
| `show_crosshair`     | `false`                     | Vertical and horizontal lines through the origin.                                                     |
| `show_origin`        | `true`                      | Draw the receiver.                                                                                    |
| `show_planes`        | `true`                      | Draw aircraft.                                                                                        |
| `show_callsign`      | `true`                      | Callsign beside the aircraft.                                                                         |
| `show_hex`           | `false`                     | ICAO hex when the callsign is hidden or missing.                                                      |
| `show_distance`      | `true`                      | Distance from the receiver on the aircraft label.                                                     |
| `show_speed`         | `true`                      | Ground speed on the aircraft label.                                                                   |
| `show_altitude`      | `false`                     | Altitude on the aircraft label. `ground` stays the word ground.                                       |
| `show_heading_line`  | `true`                      | Short line along the aircraft track. Longer when the aircraft is faster.                              |
| `show_ground`        | `true`                      | Include aircraft whose altitude is `ground`.                                                          |
| `distance_unit`      | `km`                        | `km`, `nmi`, or `mi`.                                                                                 |
| `speed_unit`         | `kmh`                       | `kmh`, `kts`, or `mph`. Source data is knots. `kmh` shows km/h.                                       |
| `altitude_unit`      | `m`                         | `m` or `ft`. The aircraft transmit feet; `m` converts them.                                          |
| `show_zoom_controls` | `true`                      | + and − buttons.                                                                                      |
| `show_reset`         | `true`                      | Button that returns the map to the receiver. With `auto_zoom` it uses the fitted zoom; otherwise `initial_zoom`. `show_recenter` still works as an older name. |
| `reset_after`        | `60`                        | Seconds of no interaction before that reset happens on its own. `0` turns the timer off.              |
| `scroll_zoom`        | `false`                     | Zoom with the mouse wheel while the pointer is over the card.                                         |
| `pan`                | `true`                      | Drag to move the map. The receiver stays pinned to its coordinates.                                   |
| `auto_zoom`          | `true`                      | Fit the zoom to the furthest aircraft, and update it as aircraft move. `false` opts out. Paused after you pan or zoom, until ↺ or `reset_after`. |
| `initial_zoom`       | `11`                        | Zoom when the card loads, when no aircraft are in view, and when `auto_zoom` is off. Integer, 4 is far away and 16 is close. |
| `min_zoom`           | `4`                         | Furthest zoom out.                                                                                    |
| `max_zoom`           | `16`                        | Closest zoom in.                                                                                      |
| `blip_size`          | `7`                         | Aircraft triangle size in pixels.                                                                     |
| `label_size`         | `12`                        | Label text size in pixels.                                                                            |
| `plane_color`        | `#e7f36a`                   | Aircraft colour.                                                                                      |
| `origin_color`       | `#ffb020`                   | Receiver colour.                                                                                      |
| `ring_color`         | `rgba(180, 255, 120, 0.55)` | Ring and crosshair colour.                                                                            |
| `sweep_color`        | `rgba(180, 255, 120, 0.18)` | Sweep wedge colour.                                                                                   |
| `label_color`        | `#f4f7f2`                   | Label text colour.                                                                                    |
| `background`         | `#1b2420`                   | Colour behind the map, and the whole card when `show_map` is false.                                   |

The default map is the OpenStreetMap standard style, `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. That server allows a page to load the tiles the user is looking at. It blocks a request it cannot tie to a site. Home Assistant often sends tiles with no Referer, and that is the 403 you saw. Each tile image now uses `Referer` of this site only. The card requests the tiles on screen, lets the browser cache them, and does not send `Cache-Control: no-cache`. The credit in the corner links to the OpenStreetMap copyright page.

If the card YAML sets `tile_url` to CARTO or Esri, remove that line. Copy the new script into `config/www` and increase the `?v=` on the Lovelace resource.

## If aircraft do not appear

The status line shows `aircraft.json failed` when the browser could not read the file. Another tar1090 that does not
send `Access-Control-Allow-Origin` will fail this way. The response needs that header, for example `*`.

Map tiles are loaded as images and do not need that header. Aircraft data does, because the card uses `fetch`.
