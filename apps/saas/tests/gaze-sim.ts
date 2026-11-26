// A realistic webcam + face-model simulator for eye-tracking tests (see gaze-calib.test.ts).
import type { Features } from '../src/core/gaze-model.ts'

export interface Head { yaw: number; pitch: number; roll: number; x: number; y: number; dist: number }
export const STILL: Head = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, dist: 60 }
const W = 1440, H = 900, PX_CM = 96 / 2.54

export function makeRand(seed: number) {
  let s = seed
  const u = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const g = () => Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u())
  return { u, g }
}

/**
 * One frame's 16 features for a gaze point (screen px) and head pose, with realistic landmark noise:
 * iris ±1.5% of the eye width, eyelid ratio ±0.06, head pose ±0.7°, translation ±0.5% of distance.
 * `mirror`: the image was mirrored before the face model (iris x sign flipped, yaw and x flipped).
 */
export function simFrame(r: { g: () => number }, sx: number, sy: number, h: Head, blink = false, mirror = false): Features {
  const ex = (sx - W / 2) / PX_CM - h.x, ey = (sy - H * 0.55) / PX_CM - h.y
  const ax = Math.atan2(ex, h.dist) - h.yaw, ay = Math.atan2(ey, h.dist) - h.pitch
  const n = (s: number) => r.g() * s
  const sg = mirror ? -1 : 1
  const ix = sg * (0.21 * Math.sin(ax) + 0.04 * Math.sin(ax) * Math.abs(Math.sin(ax))), iy = 0.07 * Math.sin(ay) + 0.03 * Math.sin(ay) ** 2
  const lid = 0.48 + 0.75 * Math.sin(ay)
  const open = blink ? 0.04 : 0.29 - 0.06 * Math.sin(ay)
  const jx = blink ? n(0.08) : 0, jy = blink ? 0.05 + n(0.05) : 0
  const scale = 0.105 * (60 / h.dist)
  const lx = ix + n(0.015) + jx, rx = ix + n(0.015) + jx
  return [
    lx, iy + n(0.012) + jy, rx, iy + n(0.012) + jy, open + n(0.012),
    sg * Math.sin(h.yaw) + n(0.004), Math.sin(h.pitch) + n(0.004), sg * h.x / h.dist + n(0.005), h.y / h.dist + n(0.005),
    (blink ? 0.9 : lid) + n(0.06), (blink ? 0.9 : lid) + n(0.06), h.roll + n(0.01), scale * (1 + n(0.01)),
    (blink ? 0.04 : open * 1.05) + n(0.012), (blink ? 0.04 : open * 1.05) + n(0.012), 0.017 * (60 / h.dist) * (1 + n(0.03)),
  ]
}
