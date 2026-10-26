# Privacy rules

These apply to every module. Copy them into code comments and into the project's README or docs.

## Never recorded
- What anyone types: field values, search text, messages.
- Names, emails, account ids, or page content.
- Camera frames or pictures (eye tracking turns each frame into landmarks in memory and drops it).

## Recorded, and nothing more
| Module | Kept |
|---|---|
| Click tracking | screen views (path, previous path, safe query); taps: position (% width, page px), the control's own visible name (aria-label or first line of its text, max 100 chars), kind, section, a selector, position on the element, aria state, time since screen opened, scroll depth, rage/dead flags, effect (navigated/changed/nothing). |
| Safe query | only short tokens (`^[\w-]{1,40}$`) from keys not listed in `freeTextParams`; research params are dropped. |
| 5-second test | the first click (as above) and its time, or "missed". |
| Fake doors | "seen" and "clicked" with an anonymous per-tab id and window width. |
| Eye tracking | estimated gaze point on the page about 15× per second (x % width, page y px, path, window size), per calibration session with its accuracy. |
| Comments | the text a reviewer deliberately writes, the spot, the page, and the author's display name. |

## Identity
- Session ids are random and per tab (sessionStorage). They are never joined to a user id.
- Participant nicknames (usability tests) are optional and typed by the participant for that purpose.

## Defaults and consent
- Click tracking is ON in development and OFF in production builds until the product owner decides how to ask for consent (banner, privacy policy). Never flip this default without being asked.
- Eye tracking needs an explicit "Turn on the camera" click after a plain-language explanation. It must always have a visible Stop button.
- Show a visible indicator whenever recording is on: the research dock's "● End session", or the eye-tracking pill.
