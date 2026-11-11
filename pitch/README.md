# Investor pitch video

- `script.md`: the narration (English, 2:00) and scene timings.
- `composition/index.html`: the motion graphics, one page at 1920×1080 drawn by `render(t)`. It loads the SaaS screenshots from `../shots/` (captured from the running app, not in the repository).
- `composition/render.cjs`: renders frames with Playwright into ffmpeg (`node render.cjs 0 3600 video.mp4`, 30 fps).
- Voice: Higgsfield `seed_audio`, voice "Arthur". Music: ElevenLabs Music (instrumental), ducked under the voice, mixed to -14 LUFS.
- The MP4 is not committed (36 MB).
