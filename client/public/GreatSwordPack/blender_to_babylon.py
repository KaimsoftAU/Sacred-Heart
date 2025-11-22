"""
Blender FBX to GLB Converter
Converts all FBX files to GLB format with animations
"""

import bpy
import os

fbx_folder = r"C:\Users\coder\Documents\Github\Sacred-Heart\client\public\Great Sword Pack"
output_folder = r"C:\Users\coder\Documents\Github\Sacred-Heart\client\public\GreatSwordPack"

# Animation FBX files to convert
fbx_files = [
    "Maria WProp J J Ong.fbx",
    "great sword idle.fbx",
    "great sword walk.fbx",
    "great sword run.fbx",
    "great sword attack.fbx",
    "great sword slash.fbx",
    "great sword blocking.fbx",
    "great sword casting.fbx",
    "great sword jump.fbx",
    "two handed sword death.fbx",
    "great sword kick.fbx",
    "great sword high spin attack.fbx",
    "great sword power up.fbx",
]

print("\n" + "="*50)
print("FBX to GLB Batch Converter")
print("="*50 + "\n")

for fbx_file in fbx_files:
    fbx_path = os.path.join(fbx_folder, fbx_file)
    glb_path = os.path.join(output_folder, fbx_file.replace(".fbx", ".glb"))
    
    if not os.path.exists(fbx_path):
        print(f"❌ Not found: {fbx_file}")
        continue
    
    try:
        # Clear scene
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        
        # Clear orphan data
        for block in bpy.data.meshes:
            if block.users == 0:
                bpy.data.meshes.remove(block)
        for block in bpy.data.armatures:
            if block.users == 0:
                bpy.data.armatures.remove(block)
        for block in bpy.data.actions:
            if block.users == 0:
                bpy.data.actions.remove(block)
        
        # Import FBX
        print(f"📥 Importing: {fbx_file}...")
        bpy.ops.import_scene.fbx(filepath=fbx_path)
        
        # Check what we got
        mesh_count = len([obj for obj in bpy.data.objects if obj.type == 'MESH'])
        armature_count = len([obj for obj in bpy.data.objects if obj.type == 'ARMATURE'])
        print(f"   Found: {mesh_count} meshes, {armature_count} armatures")
        
        # Select all for export
        bpy.ops.object.select_all(action='SELECT')
        
        # Export to GLB
        print(f"📤 Exporting: {fbx_file.replace('.fbx', '.glb')}...")
        bpy.ops.export_scene.gltf(
            filepath=glb_path,
            export_format='GLB',
            export_animations=True,
            export_force_sampling=True
        )
        
        print(f"✅ Converted: {fbx_file}\n")
        
    except Exception as e:
        print(f"❌ Error converting {fbx_file}: {str(e)}\n")

print("="*50)
print("Conversion Complete!")
print("="*50)
print(f"\nBabylon files saved to: {fbx_folder}")
print("\nNext steps:")
print("1. Check that .babylon files were created")
print("2. Update Player.ts to load .babylon files")
print("3. Refresh browser and test animations!")
