# Converting Mixamo FBX to GLB for Babylon.js

## Problem
Babylon.js does not natively support FBX files. The `@babylonjs/loaders` package only supports:
- glTF/GLB (recommended)
- OBJ  
- STL
- Babylon native formats

## ⚠️ Important: fbx2gltf doesn't work reliably
The `fbx2gltf` npm package has issues and doesn't work properly on most systems. **Use Blender instead** (it's free and much more reliable).

## ✅ RECOMMENDED: Blender Batch Conversion (5 minutes)
**This is the fastest and most reliable method!**

1. **Download Blender** (free, ~200MB): https://www.blender.org/download/
   - Or get portable version (no installation needed)
   
2. **Open Blender**

3. **Go to Scripting tab** (top menu bar)

4. **Click "New"** to create a new script

5. **Open the Python script**: 
   - File location: `client/public/GreatSwordPack/blender_batch_convert.py`
   - Copy entire contents and paste into Blender script editor

6. **Run the script**: 
   - Click play button (▶) or press `Alt+P`
   - Script will convert all 13 files automatically!

7. **Wait 2-3 minutes** for conversion to complete

8. **Done!** All GLB files will be in the GreatSwordPack folder

### Alternative: Manual Blender Conversion
1. **Download Blender** (free): https://www.blender.org/download/
2. **Import FBX**:
   - Open Blender
   - File → Import → FBX (.fbx)
   - Select your FBX file from `client/public/GreatSwordPack/`
3. **Export as GLB**:
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Choose "GLB" format
   - Enable "Include Animations"
   - Save with same name but .glb extension
4. **Repeat** for all animation files

### Method 2: Online Converter (Quick, Less Control)
Use one of these free online converters:
- https://products.aspose.app/3d/conversion/fbx-to-glb
- https://anyconv.com/fbx-to-gltf-converter/
- https://www.verge3d.com/convert-to-gltf/

**Note**: Online converters may not preserve all animation data correctly.

### Method 3: FBX2glTF CLI Tool (Advanced)
Facebook's official converter:
```bash
npm install -g fbx2gltf
fbx2gltf "Maria WProp J J Ong.fbx" "Maria WProp J J Ong.glb"
```

## Files to Convert
Convert all FBX files in `client/public/GreatSwordPack/`:

**Character Model:**
- `Maria WProp J J Ong.fbx` → `Maria WProp J J Ong.glb`

**Animations:**
- `great sword idle.fbx` → `great sword idle.glb`
- `great sword walk.fbx` → `great sword walk.glb`
- `great sword run.fbx` → `great sword run.glb`
- `great sword attack.fbx` → `great sword attack.glb`
- `great sword slash.fbx` → `great sword slash.glb`
- `great sword blocking.fbx` → `great sword blocking.glb`
- `great sword casting.fbx` → `great sword casting.glb`
- `great sword jump.fbx` → `great sword jump.glb`
- `two handed sword death.fbx` → `two handed sword death.glb`
- `great sword kick.fbx` → `great sword kick.glb`
- `great sword high spin attack.fbx` → `great sword high spin attack.glb`
- `great sword power up.fbx` → `great sword power up.glb`

## After Conversion
Once you have the GLB files:

1. Place them in `client/public/GreatSwordPack/` alongside the FBX files
2. Open `client/src/game/Player.ts`
3. **Uncomment** the character loading code (search for "COMMENTED OUT UNTIL")
4. **Comment out** the placeholder capsule mesh code
5. Restart your dev server

The code is already written and ready - it just needs the GLB files!

## Current Status
✅ Character loading system implemented
✅ Animation system with 12 animations ready
✅ Keybinds configured (Q, E, R, F, T, Y, Space)
✅ Click-to-attack on trees
⏳ **Waiting for FBX → GLB conversion**

## Keybinds Ready to Use
Once animations are loaded:
- **WASD**: Movement (auto-plays walk/run)
- **Q**: Slash attack
- **E**: Block
- **R**: Cast spell
- **F**: Kick
- **T**: Spin attack  
- **Y**: Power up
- **Space**: Jump
- **Click Tree**: Attack animation + chop tree
