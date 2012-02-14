# <pep8-80 compliant>

import struct

import bpy

# ExportHelper is a helper class, defines filename and
# invoke() function which calls the file selector.
from bpy_extras.io_utils import ExportHelper
from bpy.props import StringProperty, BoolProperty, EnumProperty


MAGIC = b'CGSG'

def object_data(obj, convert_quads_to_tris):
    vertices = []
    for v in obj.data.vertices:
        vertices.append(list(v.co) + list(v.normal))

    indices = []
    for f in obj.data.faces:
        if len(f.vertices) == 3:
            indices.extend(list(f.vertices))
        elif len(f.vertices) == 4 and convert_quads_to_tris:
            indices.extend([f.vertices[0], f.vertices[1], f.vertices[2]])
            indices.extend([f.vertices[0], f.vertices[2], f.vertices[3]])
        else:
            pass

    return vertices, indices

def prepare_data_v1_0(vertices, indices):
    # All numeric types stored in little-endian.

    # See <http://docs.python.org/py3k/library/struct.html> for details about
    # serialization with struct.

    data = b''

    #  0: 4 bytes - magic
    data += MAGIC
    #  4: 4 bytes - format version
    data += b'0100'
    #  8: 2 bytes unsigned short - single vertex size in bytes
    data += struct.pack('<H', 4 * 3 + 4 * 3)
    # 10: 4 bytes unsigned int - number of vertices
    data += struct.pack('<I', len(vertices))
    # 14: 2 bytes unsigned short - single index size in bytes
    data += struct.pack('<H', 2)
    # 16: 4 bytes unsigned int - number of indices
    data += struct.pack('<I', len(indices))

    # Vertices
    for v in vertices:
        for c in v:
            data += struct.pack('<f', c)

    # Indices
    for i in indices:
        data += struct.pack('<H', i)

    return data


def write_data(filepath, format_version, vertices, indices):
    if format_version == '0100':
        data = prepare_data_v1_0(vertices, indices)

    with open(filepath, 'wb') as f:
        f.write(data)
        

def export_to_c2g(context, filepath, format_version, convert_quads_to_tris):
    print("Exporting to '{0}'...".format(filepath))

    vertices, indices = [], []
    for obj in context.selected_objects:
        obj_vertices, obj_indices = object_data(obj, convert_quads_to_tris)

        off = len(vertices)
        vertices.extend(obj_vertices)
        indices.extend([idx + off for idx in obj_indices])

    write_data(filepath, format_version, vertices, indices)

    print("Successfully exported!")

    return {'FINISHED'}


class ExportToC2G(bpy.types.Operator, ExportHelper):
    '''Export to C2G binary format.'''
    bl_idname = "export.c2g"  # this is important since its how 
                              # bpy.ops.export.c2g is constructed
    bl_label = "Export C2G"

    # ExportHelper mixin class uses this
    filename_ext = ".c2g"

    filter_glob = StringProperty(
            default="*.c2g",
            options={'HIDDEN'},
            )

    # List of operator properties, the attributes will be assigned
    # to the class instance from the operator settings before calling.
    convert_quads_to_tris = BoolProperty(
            name="Convert Quads to Triangles",
            description="Subdivide every quad by two triangles in mesh",
            default=True,
            )

    format_version = EnumProperty(
            name="Version Format",
            description="Select C2G binary format version",
            items=(('0100', "v1.0", "Version 1.0"),
                   ),
            default='0100',
            )

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        return export_to_c2g(context, self.filepath, 
            self.format_version, self.convert_quads_to_tris)


# Only needed if you want to add into a dynamic menu
def menu_func_export(self, context):
    self.layout.operator(ExportC2G.bl_idname, text="Export to C2G Binary")


def register():
    bpy.utils.register_class(ExportToC2G)
    bpy.types.INFO_MT_file_export.append(menu_func_export)


def unregister():
    bpy.utils.unregister_class(ExportToC2G)
    bpy.types.INFO_MT_file_export.remove(menu_func_export)


if __name__ == "__main__":
    if hasattr(bpy.ops.export, 'c2g'):
        # Tool already registered, unregister.
        # TODO: Fails!
        #unregister()
        pass

    register() # COMMENTED FOR DEBUG

    # test call
    bpy.ops.export.c2g('INVOKE_DEFAULT')
