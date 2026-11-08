# Demo home

`demo_home` draws the receiver at a stand-in latitude and longitude. Use it when you record the card and do not want the
picture to show where the receiver actually is.

It is left out of the README on purpose.

```yaml
type: custom:tar1090-radar-card
base_url: https://example.com/tar1090/data
demo_home:
  lat: 51.4700
  lng: -0.4543
```

`lat` and `lng` are both required. `latitude` is accepted instead of `lat`. `lon` and `longitude` are accepted instead
of `lng`. Values outside −90…90 or −180…180 are ignored, and the card then uses the real receiver position.

The card still reads `lat` and `lon` from `receiver.json` (or the `latitude` / `longitude` fallback when that file has
no position). It keeps each aircraft’s distance and bearing from that real point, then places the receiver and the
aircraft around `demo_home`. Rings, the sweep, and the street map follow the stand-in point.

Nothing is drawn until that real position is known, so the true site does not flash on the first frame.

This only changes what the card paints. `aircraft.json` and `receiver.json` in the browser’s network panel are still the
real feed. Remove `demo_home` when you want the card to show the real site again.
