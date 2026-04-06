# Shoe Product Customizer

## Overview
Interactive 3D shoe customizer built with **Babylon.js 6.x**. Users can select zones on a GLTF shoe model, change colors/textures, preview on an animated character, and save/load design presets.

## Tech Stack
- **Engine**: Babylon.js 6.x (WebGL) via CDN
- **Model format**: GLTF binary (shoe.gltf + shoe.bin)
- **Character**: Y-Bot (dummy3.babylon) from Babylon.js asset CDN
- **Animations**: Skeleton animation ranges + external Mixamo .glb files

## Architecture

### Single-page app (index.html)
- Shoe customizer with 8 editable zones
- Integrated character preview (toggle view)
- Animation controls (idle, walk, run, etc.)
- Context floor system (basketball, tennis, street)
- Accessories system (baseball cap)

### Files
| File | Purpose |
|------|---------|
| `index.html` | Main HTML — sidebar, canvas, popups, animation bar |
| `app.js` | All application logic |
| `style.css` | All styling |
| `preview.html` | Legacy standalone preview (deprecated — merged into main app) |
| `shoe.gltf` + `shoe.bin` | Shoe 3D model |
| `normal.jpg` | Normal map texture |
| `occlusionRougnessMetalness.jpg` | PBR texture map |

### Design JSON Schema
```json
{
  "name": "string — display name",
  "zones": {
    "laces":   { "color": "#hex", "texture": "url (optional)" },
    "mesh":    { "color": "#hex", "texture": "url (optional)" },
    "caps":    { "color": "#hex", "texture": "url (optional)" },
    "inner":   { "color": "#hex", "texture": "url (optional)" },
    "sole":    { "color": "#hex", "texture": "url (optional)" },
    "stripes": { "color": "#hex", "texture": "url (optional)" },
    "band":    { "color": "#hex", "texture": "url (optional)" },
    "patch":   { "color": "#hex", "texture": "url (optional)" }
  }
}
```

### 8 Shoe Zones
| Zone Name | Friendly Name | Description |
|-----------|--------------|-------------|
| `laces` | Laces | Shoe laces |
| `mesh` | Main Body | Primary mesh surface |
| `caps` | Toe Cap | Toe cap area |
| `inner` | Inner | Inner lining |
| `sole` | Sole | Bottom sole |
| `stripes` | Stripes | Accent stripes |
| `band` | Band | Band/strap |
| `patch` | Patch | Decorative patch |

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| R | Toggle rotate mode |
| S | Toggle scale mode |
| T | Toggle translate/move mode |
| Esc | Return to orbit/view mode |
| Click zone | Select zone for color/texture editing |

### Camera Defaults
```json
{
  "alpha": -1.5708,
  "beta": 1.2566,
  "radius": 3,
  "target": { "x": 0, "y": 0, "z": 0 }
}
```

### Designs Folder
- `designs/index.json` — array of `{ "file": "name.json" }` entries
- Each `.json` file follows the Design JSON Schema above
- Presets: classic-white, fire-red, midnight-blue, neon-green, sunset-orange

### Animations Folder
- `animations/index.json` — array of `{ "file": "name.glb", "name": "Display Name", "icon": "emoji" }`
- GLB files exported from Mixamo for Y-Bot skeleton (FBX without skin → GLB)
- See `animations/README.txt` for conversion instructions

### External Dependencies (CDN)
- `https://cdn.babylonjs.com/babylon.js`
- `https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js`
- Character model: `https://assets.babylonjs.com/meshes/dummy3.babylon`
