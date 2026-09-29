'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';

// Square, centre-cropped thumbnails of downloaded images for
// the dock's downloads icon. Decoding happens off the main loop.

export const THUMB_SIZE = 256;
const MAX_SIDE = 4096;

let _imageTypes = null;

export const isImageType = (mime) => {
  if (!mime) return false;
  if (!_imageTypes) {
    _imageTypes = new Set();
    GdkPixbuf.Pixbuf.get_formats().forEach((f) =>
      f.get_mime_types().forEach((m) => _imageTypes.add(m))
    );
  }
  return _imageTypes.has(mime);
};

/**
 * Write a THUMB_SIZE square PNG of the image at `path` to `outPath`.
 * @returns {Promise<boolean>} false when the file can't be decoded
 */
export const makeThumbnail = (path, outPath) =>
  new Promise((resolve) => {
    let info;
    try {
      info = GdkPixbuf.Pixbuf.get_file_info(path);
    } catch (e) {
      info = null;
    }
    const [format, iw, ih] = info || [];
    if (!format || !iw || !ih) {
      resolve(false);
      return;
    }
    // cover-fit: shorter side lands on THUMB_SIZE; clamp absurd aspect ratios
    const scale = Math.min(
      THUMB_SIZE / Math.min(iw, ih),
      MAX_SIDE / Math.max(iw, ih)
    );
    const tw = Math.max(1, Math.round(iw * scale));
    const th = Math.max(1, Math.round(ih * scale));

    Gio.File.new_for_path(path).read_async(GLib.PRIORITY_LOW, null, (f, r) => {
      let stream;
      try {
        stream = f.read_finish(r);
      } catch (e) {
        resolve(false);
        return;
      }
      GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
        stream,
        tw,
        th,
        false,
        null,
        (_, r2) => {
          try {
            stream.close(null);
            let pb = GdkPixbuf.Pixbuf.new_from_stream_finish(r2);
            const side = Math.min(pb.get_width(), pb.get_height());
            const x = Math.floor((pb.get_width() - side) / 2);
            const y = Math.floor((pb.get_height() - side) / 2);
            pb = pb.new_subpixbuf(x, y, side, side).copy();
            if (!pb.get_has_alpha()) pb = pb.add_alpha(false, 0, 0, 0);
            if (side !== THUMB_SIZE)
              pb = pb.scale_simple(
                THUMB_SIZE,
                THUMB_SIZE,
                GdkPixbuf.InterpType.BILINEAR
              );
            pb.savev(outPath, 'png', [], []);
            resolve(true);
          } catch (e) {
            console.log(`[macos-dock-liquid-glass] thumbnail failed: ${e}`);
            resolve(false);
          }
        }
      );
    });
  });
