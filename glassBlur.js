'use strict';

import GLib from 'gi://GLib';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Cairo from 'cairo';

// Plain backdrop blur for the dock: a widget under the tinted DockBackground
// with Shell.BlurEffect in BACKGROUND mode, which blurs whatever is painted
// behind it (wallpaper and windows). Nothing else is layered on it.
export const GlassBlur = class GlassBlur {
  constructor() {
    this.actor = new St.Widget({
      name: 'd2daGlassBlur',
      reactive: false,
      // an actor with nothing to paint can be skipped along with its effects
      style: 'background-color: rgba(255, 255, 255, 0.01);',
    });
    this._lastLog = 0;
    this._blur = null;

    // Specular rim + inner sheen, painted over the tint (see _paintRim).
    this._rimState = { radius: 30, dark: true, strength: 1 };
    this.rim = new St.DrawingArea({ name: 'd2daGlassRim', reactive: false });
    this.rim.connect('repaint', (area) => this._paintRim(area));
    try {
      this._blur = new Shell.BlurEffect({
        mode: Shell.BlurMode.BACKGROUND,
        radius: 40,
        brightness: 1.0,
      });
      this.actor.add_effect_with_name('glass-blur', this._blur);
    } catch (e) {
      log(`[macos-dock-liquid-glass] blur unavailable: ${e}`);
      this._blur = null;
    }
  }

  // Liquid-glass edge: a 1px rim that is brightest on the top edge and fades
  // down the sides, a fainter line along the bottom lip, an inner second rim,
  // and a soft sheen over the top of the pill.
  _paintRim(area) {
    const { radius, dark, strength } = this._rimState;
    const [w, h] = area.get_surface_size();
    if (w < 4 || h < 4) return;
    const cr = area.get_context();
    const k = strength * (dark ? 1 : 0.8);
    const path = (inset, rad) => {
      const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
      const rr = Math.max(0, Math.min(rad, (y1 - y0) / 2, (x1 - x0) / 2));
      cr.newSubPath();
      cr.arc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0);
      cr.arc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2);
      cr.arc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI);
      cr.arc(x0 + rr, y0 + rr, rr, Math.PI, 1.5 * Math.PI);
      cr.closePath();
    };
    const grad = (stops) => {
      const g = new Cairo.LinearGradient(0, 0, 0, h);
      stops.forEach(([o, a]) => g.addColorStopRGBA(o, 1, 1, 1, Math.min(1, a * k)));
      return g;
    };

    // Inset glow, after the reference CSS: inset 0 0 2px 1px white/.35,
    // inset 0 0 10px 4px white/.15. Stacked 1px strokes stand in for the
    // blurred inset shadows; each is brighter toward the top edge.
    const bands = [0.38, 0.20, 0.13, 0.09, 0.06, 0.04, 0.025, 0.015];
    cr.setLineWidth(1);
    bands.forEach((a, i) => {
      path(i + 0.5, radius - i);
      cr.setSource(grad([[0, a * 1.5], [0.4, a * 0.8], [0.7, a * 0.7], [1, a * 1.1]]));
      cr.stroke();
    });

    // sheen: light entering the top of the lens
    path(1, radius - 1);
    cr.setSource(grad([[0, 0.10], [0.4, 0.02], [1, 0]]));
    cr.fill();

    cr.$dispose();
  }

  // Track the DockBackground pill.
  sync(background, { enabled, sigma = 40, scale = 1, radius = 30, dark = true, strength = 1 }) {
    const show = !!enabled && !!this._blur && background.opacity > 0 &&
      background.width > 0 && background.height > 0;
    this.actor.visible = show;
    this.rim.visible = show;
    if (!show) return;

    this.actor.set_position(background.x, background.y);
    this.actor.set_size(background.width, background.height);
    this.actor.translation_x = background.translation_x;
    this.actor.translation_y = background.translation_y;
    this.actor.opacity = background.opacity;
    this._blur.radius = sigma * scale;

    this.rim.set_position(background.x, background.y);
    this.rim.set_size(background.width, background.height);
    this.rim.translation_x = background.translation_x;
    this.rim.translation_y = background.translation_y;
    this.rim.opacity = background.opacity;
    const st = this._rimState;
    if (st.radius !== radius || st.dark !== dark || st.strength !== strength) {
      Object.assign(st, { radius, dark, strength });
      this.rim.queue_repaint();
    }

    const now = GLib.get_monotonic_time();
    if (now - this._lastLog > 30e6) {
      this._lastLog = now;
      log(`[macos-dock-liquid-glass] blur ok ${Math.round(background.width)}x${Math.round(background.height)} ` +
        `mapped=${this.actor.mapped}`);
    }
  }

  destroy() {
    try {
      this.actor.destroy();
      this.rim.destroy();
    } catch (e) {
      // already gone with the dock
    }
    this.actor = null;
    this._blur = null;
  }
};
