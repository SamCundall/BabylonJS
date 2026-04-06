# PLAN — Shoe Customizer Overhaul

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1 — Documentation & Config
- [x] 1.1 Create `PROJECT.md`
- [x] 1.2 Create `.copilot_instructions.md`
- [x] 1.3 Create `PLAN.md`

## Phase 2 — Preview Integration (Tab/Toggle)
- [x] 2.1 Merge preview into main app as toggle view
- [x] 2.2 Character hidden by default (only loads on first Preview click)
- [x] 2.3 Animation controls in main UI (idle, walk, run, strafe, jump + extra glb)

## Phase 3 — Shoe-Drop Transition & Context Floor
- [x] 3.1 Camera transition animation (smooth ease-in-out between shoe/character views)
- [x] 3.2 Context floor system (user selects: basketball, tennis, street, grass, track)

## Phase 4 — UX Fixes
- [x] 4.1 Zone highlight → HighlightLayer outline glow (not emissive fill)
- [x] 4.2 Modal positioning 120px away from click (was 20px)
- [x] 4.3 Camera reset → animated transition (fixes two-press bug)

## Phase 5 — UV Grid Texture
- [x] 5.1 Programmatic 1024x1024 numbered grid via DynamicTexture + toggle button

## Phase 6 — External 3D Assets
- [x] 6.1 Mixamo FBX list documented (see Asset Notes below)
- [x] 6.2 Placeholder baseball cap (sphere+disc on head bone) + Hat toggle button

---

## Verification / Manual Tests

| # | Test | Status |
|---|------|--------|
| T1 | Preview toggle: click → character appears with matching shoe design, click again → hides | [ ] |
| T2 | Design carry-over: change shoe color → toggle preview → colors match on character | [ ] |
| T3 | Shoe drop transition: toggle preview → shoe animates down, floor rises, smooth | [ ] |
| T4 | Floor context: select "Basketball Court" → floor texture changes | [ ] |
| T5 | Zone highlight: hover → outline glow, NOT color wash, design still visible | [ ] |
| T6 | Modal distance: click zone → popup ~120px away, zone visible while editing | [ ] |
| T7 | Camera reset: orbit anywhere → Reset → correct view on FIRST click | [ ] |
| T8 | UV grid: "Show UV Grid" → numbered grid on all zones, removable | [ ] |
| T9 | Character hidden default: page load → shoe only, no character visible | [ ] |
| T10 | Animations: preview mode → Walk/Run/Idle buttons work | [ ] |
| T11 | Hat toggle: "Show Hat" → cap on character head, positioned correctly | [ ] |
| T12 | Preset designs: click Classic White, Fire Red, etc. → colors update | [ ] |
| T13 | Save design: Save → JSON downloads with correct 8-zone hex colors | [ ] |

**Tests remaining: 13**

---

## Decisions
- Preview style: Tab/toggle view (same canvas)
- Floor selection: User-driven dropdown
- Clothing priority: Baseball cap only for now
- Highlight: Babylon.js `HighlightLayer` for outline glow
- Camera fix: `rebuildAnglesAndRadius()` after reset
- Grid texture: Programmatic Canvas API generation

## Asset Notes
- **Mixamo animations to download** (FBX without skin for Y-Bot):

  ### How to get FBX files:
  1. Go to https://www.mixamo.com/ → sign in (free Adobe account)
  2. Select **Y Bot** as character
  3. Search for each animation below → click → Download:
     - Format: **FBX Binary (.fbx)**
     - Skin: **Without Skin**
  4. Convert each FBX to GLB (Blender → Import FBX → Export glTF Binary)
  5. Place GLB in `animations/` folder
  6. Add entry to `animations/index.json`

  | # | Mixamo Search Term | Suggested Filename | Icon |
  |---|-------------------|-------------------|------|
  | 1 | `basketball dribble` | basketball.glb | 🏀 |
  | 2 | `tennis forehand` | tennis.glb | 🎾 |
  | 3 | `running` | running.glb | 🏃 |
  | 4 | `jump` | jump.glb | 🦘 |
  | 5 | `breathing idle` | breathing.glb | 🧘 |
  | 6 | `walking` | walking.glb | 🚶 |
  | 7 | `jogging` | jogging.glb | 🏃 |
  | 8 | `victory` | victory.glb | 🏆 |

  Example `animations/index.json` after converting:
  ```json
  [
    { "file": "basketball.glb", "name": "Basketball", "icon": "🏀" },
    { "file": "tennis.glb", "name": "Tennis", "icon": "🎾" },
    { "file": "running.glb", "name": "Running", "icon": "🏃" },
    { "file": "victory.glb", "name": "Victory", "icon": "🏆" }
  ]
  ```

- **Baseball cap**: Currently using placeholder geometry (sphere + disc). For a proper model:
  - Sketchfab "Baseball Cap" by Scott VanArsdale (CC Attribution, 45k downloads)
  - Download GLTF → decimate in Blender (93k → ~5k tris) → place as `hat.glb`
