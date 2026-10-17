# Saint — Halcyon

Open **Start.cmd** on Windows. This starts a local server and opens
http://localhost:1997. Keep the server window open while watching.

Alternatively, run `node server.mjs` and open http://localhost:1997.
The directory can also be served by any static HTTP server. Opening
`index.html` directly with a file URL will not load the browser workers.

The entry page and fullscreen player follow Nation Zero's presentation.
Space pauses/resumes, Left/Right seek ten seconds, F toggles fullscreen,
and Escape stops. Music starts automatically with Start at full output level.
Controls appear
when the pointer moves and hide in fullscreen; keyboard controls still work.
The timeline has stored graphics and audio checkpoints every 15 seconds.
Seeking restores the nearest earlier point and computes the short remaining
interval. The −15s/+15s buttons jump backward and forward. A “Loading…” overlay
remains visible until the requested picture and music are both prepared.
The **Stats for nerds** switch shows displayed FPS, rendering time, the current
scene, audio playback details and a live four-channel S3M tracker, following
Bjoer's stats panel. It is hidden by default and remains available in fullscreen
when enabled before entering fullscreen.

Rendered scenes target 30 FPS. Graphics follow the consumed soundtrack clock;
if drawing takes longer, obsolete drawings are skipped while timer updates
continue. Stats also shows how far the displayed picture trails the audio.
The original opening film keeps its existing playback cadence.

This directory is standalone: `app` contains the player, `runtime` contains
the translated drawing and music code, and `data` contains only the startup
state, original soundtrack initialization data and thirteen production assets
required by that code. The original packed opening film is already embedded in
the required startup data and is decoded live.
No workspace, oracle, reports, captures collection, tools or external service
is required. The single startup memory image is currently necessary runtime
input; executable startup has not yet been translated.

Playback now starts with the original film of the guys, then carries the
soundtrack state into the rendered scenes. The FPATAN stop in orange is fixed:
the original geometry's quiet NaNs now propagate correctly. The complete
film-start sequence spans about 267 seconds. Stored states use the validated
10 Hz computation cadence; live rendering uses the 30 FPS target above.
Native hardware startup and exact production
timing remain outside this browser scheduling model. Further fixes and
optimization should be made directly in this packaged version.

Stored seek states are computed by the packaged renderer and mixer, not copied
reference frames or audio. To rebuild them after a runtime change, run
`node tools/build_release_seek.mjs` from the parent workspace. Every generated
graphics/audio point is restored and compared with continued computation.

Original production: Saint, final version, Halcyon, August 1997.
Code: Blitz, Placidity. Player: Asmu. Protected mode: Tran. Meshes: Ren.
Graphics: Shrine, Placidity, Croaker. Music: Naks, Pam and Vesuri of Da Jormas.
