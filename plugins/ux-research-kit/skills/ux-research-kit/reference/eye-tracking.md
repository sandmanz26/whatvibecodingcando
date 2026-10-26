# Eye tracking (webcam)

Files: `gaze-engine.ts`, `gaze-runner.ts`. Runtime: `@mediapipe/tasks-vision@1.1.0` (Apache-2.0). Avoid WebGazer: it is GPL-3.0 and would put the project under GPL.

## How it works
1. **Landmarks:** MediaPipe Face Landmarker gives 478 landmarks (irises included) per frame, in the browser.
2. **Features:**
   - per eye, where the iris sits between the eye corners (x) and between the lids (y), divided by eye width;
   - mean eye openness;
   - the head's forward axis and position, from the facial transformation matrix.
3. **Calibration:** 9 dots (a 3×3 grid at 10/50/90%). The participant looks at each dot and clicks it, then about 900 ms of frames are collected (the first 150 ms are skipped). At least 6 frames with a face are needed, or the dot asks again.
4. **Model:** a ridge regression (standardised features, λ = 0.5) for x and for y.
5. **Accuracy check:** 4 dots (30/70%). Report the mean error in px:
   - ≤ 120: good for areas;
   - ≤ 220: rough;
   - more: refuse recording and ask to recalibrate.
6. **Recording:** smoothed (EMA 0.3) and sampled about 15×/s. Points are stored as `{ sid, t, page, x %, y page px, vw, vh }`, and only while the tab is visible and not on research routes.

## Participant UI
Participant link: `/?gaze`.
1. Consent card in plain language: what is kept, what is not, and that they can stop any time.
2. "Turn on the camera".
3. Calibration stage with a small mirrored preview and an "Eyes found" status.
4. Result card with the accuracy.
5. A recording pill with "±N px" and a Stop button.

## Console (screen to generate)
- **Start:** "Start a session" opens the participant link in a new tab.
- **Heatmap:** a screen picker, a device switch, and the screen viewer in gaze mode.
- **Sessions:** a list showing time, layout, seconds of gaze, and accuracy.
- **Delete:** delete all gaze data.

Always state the coarseness (100–200 px).

## Testing without a face
Launch Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. Expect "Looking for your face…", and "Couldn’t see your eyes" after a dot click. Cancel must stop the camera.

To test the regression itself, feed synthetic features (see `fit`/`predict`); errors should be a few px.
