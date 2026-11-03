/**
 * Sound, from the recordings in `sounds/`.
 *
 * Three loops, faded in and out by the state of the boat every frame:
 * - water: `sailing_sound.mp3`, louder and a touch higher as she speeds up;
 * - luffing: the flapping sail (with its summer insects), when the sail
 *   is not drawing: in irons, sheeted out too far, or mid-tack;
 * - flag: `flag_sound.mp3`, the wind in the rig, with the apparent wind.
 *
 * And one-shots:
 * - the mainsheet running (`mainsheet_sound_1/2.mp3`) when the boom moves
 *   quickly: trimming, easing, or swinging across;
 * - the sail filling (`sail_deploy.mp3`) when it fills on the new side
 *   after a tack or a gybe.
 *
 * Browsers only allow sound after the user has touched the page, so the
 * audio starts on the first click or key press.  It all gets quieter as
 * the camera pulls away from the boat, and pauses while the tab is hidden.
 */

const DIR = 'sounds/';
const FILES = {
  water: 'sailing_sound.mp3',
  luff: 'freesound_community-sailboat-sail-flapping-with-insect-summer-ambience-24216.mp3',
  flag: 'flag_sound.mp3',
  sheet1: 'mainsheet_sound_1.mp3',
  sheet2: 'mainsheet_sound_2.mp3',
  fill: 'sail_deploy.mp3',
};
const LOOP_LEVEL = { water: 0.9, luff: 0.75, flag: 0.35 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createSound() {
  let ctx = null, master = null, enabled = true, ready = false;
  const buf = {};
  const loops = {};
  let lastBoom = null, sheetCool = 0, fillCool = 0;
  let drawnSide = 0;          // the side the sail last filled on, -1 / +1
  const played = [];          // recent one-shots, for tests

  function start() {
    if (ctx) { if (ctx.state === 'suspended' && enabled && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    Promise.all(Object.entries(FILES).map(([k, f]) =>
      fetch(DIR + f).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => { buf[k] = b; })
        .catch((e) => console.warn('sound: could not load', f, e))))
      .then(() => {
        for (const k of Object.keys(LOOP_LEVEL)) {
          if (!buf[k]) continue;
          const src = ctx.createBufferSource();
          src.buffer = buf[k]; src.loop = true;
          const g = ctx.createGain(); g.gain.value = 0;
          src.connect(g).connect(master);
          src.start(0, Math.random() * buf[k].duration);   // so the loops don't line up
          loops[k] = { src, g };
        }
        ready = true;
      });
  }
  const kick = () => start();
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume();
  });

  function oneShot(name, gain, offset = 0, rate = 1) {
    if (!ready || !buf[name] || !enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = buf[name]; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(0, offset);
    played.push(name); if (played.length > 20) played.shift();
  }

  function level(k, v, tc = 0.25) {
    const L = loops[k];
    if (L) L.g.gain.setTargetAtTime(v * LOOP_LEVEL[k], ctx.currentTime, tc);
  }

  /**
   * Every frame.  `s`: the viewer's state (speed, wind, app, fill, boom),
   * `dt` in seconds, `camDist`: the camera's distance from the boat.
   */
  function update(s, dt, camDist) {
    if (!ready) { lastBoom = s.boom; return; }
    const near = clamp(1 - (camDist - 7) / 60, 0.2, 1);
    master.gain.setTargetAtTime(enabled ? near : 0, ctx.currentTime, 0.3);

    const kn = s.speed * 18;                         // boat speed, knots
    const sp = clamp(kn / 4, 0, 1);
    const wind = clamp(s.wind / 0.9, 0, 1);
    const appW = clamp(s.app / 0.9, 0, 1);
    level('water', 0.12 + 0.88 * sp);
    if (loops.water) loops.water.src.playbackRate.setTargetAtTime(0.9 + 0.22 * sp, ctx.currentTime, 0.5);

    // luffing: the cloth is not drawing (|fill| low) and there is air to shake it
    const slack = 1 - clamp(Math.abs(s.fill) / 0.7, 0, 1);
    level('luff', slack * slack * (0.25 + 0.75 * appW), 0.15);
    level('flag', 0.25 + 0.75 * appW, 0.6);

    // the mainsheet runs when the boom moves fast
    sheetCool -= dt; fillCool -= dt;
    if (lastBoom !== null && dt > 0) {
      const rate = Math.abs(s.boom - lastBoom) / dt;   // degrees a second
      if (rate > 18 && sheetCool <= 0) {
        oneShot(Math.random() < 0.5 ? 'sheet1' : 'sheet2',
          clamp(0.35 + rate / 120, 0.35, 0.9), 0.12, 0.92 + Math.random() * 0.16);
        sheetCool = 0.55 + Math.random() * 0.3;
      }
    }
    lastBoom = s.boom;

    // the sail fills on the other side: a tack or a gybe is done
    if (Math.abs(s.fill) > 0.75) {
      const side = Math.sign(s.fill);
      if (drawnSide !== 0 && side !== drawnSide && fillCool <= 0) {
        oneShot('fill', 0.5 + 0.5 * wind);
        fillCool = 3;
      }
      drawnSide = side;
    }
  }

  function setEnabled(on) {
    enabled = on;
    if (!ctx) return;
    if (on) { ctx.resume(); master.gain.setTargetAtTime(1, ctx.currentTime, 0.1); }
    else master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }

  return {
    update, setEnabled, start,
    get ready() { return ready; },
    get enabled() { return enabled; },
    get context() { return ctx; },
    played,
    levels: () => Object.fromEntries(Object.entries(loops).map(([k, L]) => [k, +L.g.gain.value.toFixed(3)])),
  };
}
