// Glue for the explainer pages. Both demos replay the original translated
// routines through demo-core.mjs instead of drawing invented illustrations:
// a seek checkpoint restores the guest machine inside the scene, and the
// generated drawing code produces every frame with the real texture and DAC
// palette. Classic script + dynamic module import, so any static file server
// can host this page without extra tooling.
(function () {
  'use strict';
  var canvas = document.querySelector('#demo');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var scene = document.body.dataset.scene;
  var config = scene === 'cavern'
    ? { label: 'cavern', seekSeconds: 180, startSeconds: 183.4, endSeconds: 212.4, assets: ['PALLOAK2.ER', 'AURI.ER'] }
    : { label: 'opening passage', seekSeconds: 15, startSeconds: 15, endSeconds: 35.48, assets: [] };
  var timeline = document.querySelector('#timeline');
  var speedInput = document.querySelector('#speed');
  var pauseButton = document.querySelector('#pause');
  var statusOutput = document.querySelector('#playback-state');
  var timeOutput = document.querySelector('#timeOut');

  var replay = null;
  var state = { time: config.seekSeconds, speed: 1, paused: false, lastPainted: null };
  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion && pauseButton) {
    state.paused = true;
    pauseButton.textContent = 'Resume playback';
  }

  function setStatus(message) { if (statusOutput) statusOutput.textContent = message; }
  function sceneWindowText(seconds) {
    var globalSeconds = config.startSeconds - config.seekSeconds + seconds;
    var label = globalSeconds < config.startSeconds ? 'approach to the scene' : (scene === 'cavern' ? 'cavern' : 'passage');
    return 'player ' + globalSeconds.toFixed(1) + ' s · ' + label + ' · +' + seconds.toFixed(1) + ' s';
  }

  function paint(frame) {
    // 320×200 indexed frame → offscreen canvas → nearest-neighbour ×2 blit.
    var rgba = explainCore.frameToRgba(frame);
    var work = paintWork || (paintWork = function () {
      var off = document.createElement('canvas');
      off.width = 320; off.height = 200;
      off.ctx = off.getContext('2d');
      off.image = off.ctx.createImageData(320, 200);
      return off;
    }());
    work.image.data.set(rgba);
    work.ctx.putImageData(work.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(work, 0, 0, 320, 200, 0, 0, canvas.width, canvas.height);
  }
  var paintWork = null;

  function updateTimeline() {
    if (timeline && document.activeElement !== timeline) {
      timeline.value = (state.time - config.seekSeconds).toFixed(2);
    }
    if (timeOutput) timeOutput.textContent = sceneWindowText(state.time - config.seekSeconds);
  }

  function tick(now) {
    var last = tick.last || now;
    tick.last = now;
    if (replay) {
      if (!state.paused && !tick.dwell) {
        state.time = Math.min(config.endSeconds, state.time + Math.min((now - last) / 1000, 0.1) * state.speed);
        if (state.time >= config.endSeconds) {
          tick.dwell = now + 900; // hold the final frame briefly before looping
        }
      } else if (tick.dwell && now >= tick.dwell) {
        tick.dwell = 0;
        state.time = config.seekSeconds;
      }
      var result = replay.advanceTo(state.time);
      if (result.frame) paint(result.frame);
      updateTimeline();
      setStatus(result.done
        ? 'Original routines · every pixel from the translated scene code'
        : 'Replaying toward ' + sceneWindowText(state.time - config.seekSeconds) + '…');
    }
    requestAnimationFrame(tick);
  }

  function wireControls() {
    if (pauseButton) {
      pauseButton.addEventListener('click', function () {
        state.paused = !state.paused;
        tick.dwell = 0;
        pauseButton.textContent = state.paused ? 'Resume playback' : 'Pause playback';
      });
    }
    if (speedInput) {
      state.speed = parseFloat(speedInput.value) || 1;
      speedInput.addEventListener('input', function () {
        state.speed = parseFloat(speedInput.value) || 1;
      });
    }
    if (timeline) {
      timeline.min = '0';
      timeline.max = (config.endSeconds - config.seekSeconds).toFixed(2);
      timeline.step = '0.05';
      timeline.value = '0';
      timeline.addEventListener('input', function () {
        tick.dwell = 0;
        state.time = config.seekSeconds + parseFloat(timeline.value);
      });
    }
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Could not load ' + url + ' (' + response.status + ')');
      return response.json();
    });
  }
  function fetchBytes(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Could not load ' + url + ' (' + response.status + ')');
      return response.arrayBuffer();
    }).then(function (buffer) { return new Uint8Array(buffer); });
  }
  function fetchGunzipped(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Could not load ' + url + ' (' + response.status + ')');
      return response.body.pipeThrough(new DecompressionStream('gzip'));
    }).then(function (stream) { return new Response(stream).arrayBuffer(); })
      .then(function (buffer) { return new Uint8Array(buffer); });
  }

  setStatus('Loading original machine state…');
  Promise.all([
    fetchBytes('../data/start.bin'),
    fetchJson('../data/start.json'),
    fetchJson('../data/seek/index.json'),
    import('./demo-core.mjs'),
  ]).then(function (loaded) {
    var baseBytes = loaded[0], seekIndex = loaded[2], core = loaded[3];
    explainCore = core;
    var entry = seekIndex.graphics.filter(function (point) { return point.seconds <= config.seekSeconds; }).pop();
    if (!entry) throw new Error('No seek checkpoint at or before ' + config.seekSeconds + ' s');
    return fetchGunzipped('../data/seek/' + entry.file).then(function (checkpointBytes) {
      return Promise.all(config.assets.map(function (name) {
        return fetchBytes('../data/assets/' + name).then(function (bytes) { return [name, bytes]; });
      })).then(function (assets) {
        replay = new core.SceneReplay({
          baseBytes: baseBytes,
          checkpointBytes: checkpointBytes,
          files: assets,
          start: config.seekSeconds,
          end: config.endSeconds,
        });
        if (timeline) {
          timeline.min = '0';
          timeline.max = (config.endSeconds - config.seekSeconds).toFixed(2);
        }
      });
    });
  }).then(function () {
    // Prove the restore works even before the animation loop catches up.
    var settled = replay.advanceTo(config.seekSeconds + 1);
    if (settled.frame) paint(settled.frame);
    setStatus('Restored at ' + sceneWindowText(0) + ' — playing the original translated routines');
    requestAnimationFrame(tick);
  }).catch(function (error) {
    setStatus('Replay unavailable: ' + error.message + (location.protocol === 'file:' ? ' — serve this page over http.' : ''));
    console.error(error);
  });

  var explainCore = null;
  wireControls();
})();
