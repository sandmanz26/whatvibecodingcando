# ux-research-kit

A Claude Code skill that adds UX research tooling to any web frontend: click tracking with sessions and exact tap replay, heatmaps (taps and gaze), 5-second tests, fake doors, webcam eye tracking, comments, and design-token / UI-library look simulation, plus a research console built in the project's own components.

## Install

**As a plugin**, inside Claude Code:

```
/plugin marketplace add sandmanz26/whatvibecodingcando
/plugin install ux-research-kit@whatvibecodingcando
```

**As a plain skill**: copy `skills/ux-research-kit/` into `~/.claude/skills/` (for all projects) or into a project's `.claude/skills/`.

## Use

Ask Claude in the target project, for example:
- "Add session tracking and heatmaps"
- "Set up a fake door for an Export button on the reports page"
- "Run a 5-second test on the landing page"
- "Let me preview our tokens with a Material 3 look"

The skill reads the project and copies the framework-agnostic modules from `templates/core/` into it, then wires them to the router, builds the console screens and verifies them in a browser.

## What's inside
- `SKILL.md`: the workflow Claude follows.
- `templates/core/`: TypeScript modules with no framework dependency (eye tracking needs `@mediapipe/tasks-vision`, Apache-2.0).
- `reference/`: specs per module, the privacy rules and a verification checklist.

These modules were extracted from the research tools in Skillhouse (this repository) and tested in a separate vanilla TypeScript app.
