Adding Extra Animations (Mixamo → Babylon.js)
===============================================

The preview page can load additional character animations from this folder.
Each animation should be a .glb file exported from Mixamo for the Y-Bot skeleton.

How to add a new animation:
---------------------------

1. Go to https://www.mixamo.com/ and sign in (free Adobe account).

2. In the Characters panel, make sure "Y Bot" is selected (this matches the
   dummy3.babylon skeleton used in the preview).

3. Browse or search for an animation (e.g. "Basketball", "Tennis", "Jump",
   "Breakdance", "Salsa", "Golf", "Soccer", etc.).

4. Click "Download" and choose these settings:
      Format:       FBX Binary (.fbx)
      Skin:         Without Skin
      Frames:       (leave default)
      Keyframe:     (leave default)

5. Convert the .fbx file to .glb using one of these methods:

   A) Blender (recommended):
      - Open Blender → File → Import → FBX (.fbx)
      - Select only the Armature/Animation, not the mesh
      - File → Export → glTF 2.0 (.glb/.gltf)
      - Choose "glTF Binary (.glb)" format
      - Under "Include", check only "Animations"
      - Save as e.g. "basketball.glb"

   B) Online converter:
      - Use https://products.aspose.app/3d/conversion/fbx-to-glb
      - Or https://imagetostl.com/convert/file/fbx/to/glb

6. Place the .glb file in this "animations/" folder.

7. Edit "index.json" in this folder to register the animation:

   [
     {
       "file": "basketball.glb",
       "name": "Basketball",
       "icon": "🏀"
     },
     {
       "file": "tennis.glb",
       "name": "Tennis",
       "icon": "🎾"
     }
   ]

   Fields:
     file  - filename of the .glb in this folder (required)
     name  - display name for the button (required)
     icon  - emoji icon shown before the name (optional, defaults to ▶)

8. Refresh the preview page — the new animation buttons will appear
   automatically in the bottom animation bar.

Notes:
------
- The procedural "Jump" animation is built-in and doesn't need a file.
- Animations should target the same Y-Bot skeleton (Mixamo's default).
- File size matters — keep animations under 5 MB each for fast loading.
- If an animation doesn't play correctly, it may have a different skeleton
  rig. Make sure to use "Without Skin" when downloading from Mixamo.
