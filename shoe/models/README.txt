Models Folder — Adding New 3D Models
======================================

Supported formats: .gltf, .glb
Both are loaded by the same Babylon.js GLTF loader.

Folder structure
----------------
models/
  index.json          ← manifest listing all models
  shoe/               ← one subfolder per model
    shoe.gltf
    shoe.bin
    normal.jpg
    occlusionRougnessMetalness.jpg
  hat/                ← example additional model
    hat.glb

How to add a new model
----------------------
1. Create a subfolder under models/ (e.g. models/backpack/)
2. Place your .gltf or .glb file (and any .bin / texture files) inside it
3. Add an entry to models/index.json:

   {
       "id": "backpack",
       "name": "Backpack",
       "folder": "backpack",
       "file": "backpack.glb",
       "zones": ["body", "strap", "zipper", "pocket"],
       "friendlyNames": {
           "body": "Body",
           "strap": "Strap",
           "zipper": "Zipper",
           "pocket": "Pocket"
       }
   }

Zone names
----------
Each "zone" corresponds to a MATERIAL NAME inside your 3D model.
When exporting from Blender / 3DS Max / Maya, name your materials to
match the zone names in this manifest. The customizer will find
materials by name (case-insensitive) and make them editable.

Tips
----
- .glb is recommended (single file, faster to load)
- .gltf works too but requires .bin + texture files in the same folder
- Use PBR materials for best results (metalness, roughness, normal maps)
- Keep material names simple and lowercase
- Each zone = one material = one customizable area
