# Copyright (C) 2012  Vladimir Rutsky <altsysrq@gmail.com>

# The MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

# <pep8-80 compliant>

import struct
import textwrap
import base64
import json
import itertools

import bpy

# ExportHelper is a helper class, defines filename and
# invoke() function which calls the file selector.
from bpy_extras.io_utils import ExportHelper
from bpy.props import StringProperty, BoolProperty, EnumProperty


class Constants:
    magic = b'c2g\x1e'

    float_size = 4
    ushort_size = 2
    num_position_comps = 3
    num_normal_comps = 3
    num_color_comps = 3
    num_tex_comps = 2

def object_triangles_data(data):
    """Retrieve object vertices and indices data for drawing with GL_TRIANGLES
    
    Returns tuple (description, vertices, indices), where 
      * description - tuple of
        * number of vertex colors per vertex,
        * number of texture coordinates per vertex;
      * vertices - list of tuples of 
        * v.x, v.y, v.z - vertex coordinates (float),
        * n.x, n.y, n.z - vertex normal (float),
        * c_1.r, c_1.g, c_1.b
          ...
          c_n.r, c_n.g, c_n.b - vertex colors (float),
        * t_1.u, t_2.v
          ...
          t_n.u, t_n.v - vertex texture coordinates (float);
      * indices of  

    Example of return data:

      (
       # description:
       (1,   # single color for each vertex
        2),  # two texture coordinates for each vertex
       
       # vertices:
       (  # first vertex:
        (
          0.0, 0.0, 0.0,  # position
          0.0, 0.0, 1.0,  # normal
          127,   0, 130,  # color 1
          0.7, 0.3,       # texture coordinate 1
          0.0, 0.5,       # texture coordinate 2
        ),
          # second vertex:
        (...),
       ),

       # indices:
       (0, 1, 2, # first triangle
        2, 1, 3, # second triangle
        ...
       )
      )
    """

    if not (hasattr(data, 'vertices') and hasattr(data, 'tessfaces')):
        print("Object doesn't have faces or vertices "
            "attributes")
        return [0, 0], [], []

    vertex_to_index = {}
    indices = []

    for face_idx, face in enumerate(data.tessfaces):
        face_vertices_indices = []
        for face_vert_idx, vert_idx in enumerate(face.vertices):
            # For each vertex of face extract required information.
            vertex = []
            
            vertex.extend(data.vertices[vert_idx].co)
            vertex.extend(data.vertices[vert_idx].normal)

            for color_layer in data.tessface_vertex_colors:
                color = getattr(color_layer.data[face_idx], 
                                "color{0}".format(face_vert_idx + 1))
                vertex.extend(color)

            for tex_coord_layer in data.tessface_uv_textures:
                tex_coord = getattr(tex_coord_layer.data[face_idx], 
                                "uv{0}".format(face_vert_idx + 1))
                vertex.extend(tex_coord)

            idx = vertex_to_index.setdefault(tuple(vertex), 
                                             len(vertex_to_index))
            face_vertices_indices.append(idx)

        # Face tesselation (actually face can have only 3 and 4 vertices).
        for i in range(1, len(face_vertices_indices) - 1):
            indices.extend([0, i, i + 1])

    num_colors = len(data.tessface_vertex_colors)
    num_tex_coords = len(data.tessface_uv_textures)

    # Extract ordered list of vertices from vertex to index map.
    vertices = list(map(lambda x: x[0], 
                        sorted(vertex_to_index.items(), key=lambda x: x[1])))

    return (num_colors, num_tex_coords), vertices, indices

def prepare_binary_data_v0_1(description, vertices, indices):
    """Prepares binary representation of geometry data"""

    # All numeric types stored little-endian.

    # See <http://docs.python.org/py3k/library/struct.html> for details about
    # serialization with struct.

    data = b''

    #  0: 4 bytes - magic
    data += Constants.magic
    #  4: 4 bytes - format version
    data += b'0001'

    #  8: 2 bytes unsigned short - number of colors per vertex
    data += struct.pack('<H', description[0])
    # 10 2 bytes unsigned short - number of texture coordinates per vertex
    data += struct.pack('<H', description[1])

    C = Constants
    vertex_size = C.float_size * (C.num_position_comps + C.num_normal_comps + 
                                C.num_color_comps * description[0] + 
                                C.num_tex_comps * description[1])

    # 12: 2 bytes unsigned short - single vertex size in bytes
    data += struct.pack('<H', vertex_size)
    # 14: 2 bytes unsigned short - single index size in bytes
    data += struct.pack('<H', C.ushort_size)
    # 16: 4 bytes unsigned int - number of vertices
    data += struct.pack('<I', len(vertices))
    # 20: 4 bytes unsigned int - number of indices
    data += struct.pack('<I', len(indices))

    # Vertices
    for v in vertices:
        for c in v:
            data += struct.pack('<f', c)

    # Indices
    for i in indices:
        data += struct.pack('<H', i)

    return data


def write_data(filepath, format_version, data, write_base64=False, 
               write_json=False):
    if format_version == '0001':
        data_bin = prepare_binary_data_v0_1(*data)
    else:
        assert False

    file_name = filepath
    print("  Writing binary to {0}".format(file_name))
    with open(file_name, 'wb') as f:
        f.write(data_bin)

    if write_base64:
        file_name = filepath + '.base64'
        print("  Writing Base64 representation to {0}".format(file_name))
        with open(file_name, 'wb') as f:
            f.write(base64.b64encode(data_bin))
        
    if write_json:
        file_name = filepath + '.json'
        print("  Writing JSON representation to {0}".format(file_name))
        with open(file_name, 'wt') as f:
            data_json = textwrap.dedent("""\
            [
              {descr},
              {vertices},
              {indices}
            ]
            """.format(
                descr=json.dumps(data[0]), 
                vertices=json.dumps(list(itertools.chain(*data[1]))),
                indices=json.dumps(data[2])))
            f.write(data_json)


def export_to_c2g(context, filepath, format_version, 
                  write_base64=False, write_json=False):
    """Export object geometry to C2G format"""

    obj = context.active_object
    print("Exporting '{0}'...".format(obj.name))

    obj_data = obj.data

    # Since Blender 2.62 internal representation of faces changed to NGons.
    # explicitly day Blender to generate Ngons triangulation.
    obj_data.update(calc_tessface=True)

    print(textwrap.dedent("""\
          Blender mesh:
            vertices: {verts}
            faces: {faces}
            vertex color layers: {colors}
            texture coords layers: {texs}
          """.format(
            verts=len(obj_data.vertices),
            faces=len(obj_data.tessfaces),
            colors=len(obj_data.tessface_vertex_colors),
            texs=len(obj_data.tessface_uv_textures))
          ))

    data = object_triangles_data(obj.data)
    if data is not None:
        C = Constants
        vertex_components = (C.num_position_comps + C.num_normal_comps + 
            C.num_color_comps * data[0][0] + C.num_tex_comps * data[0][1])
        print(textwrap.dedent("""\
              Generated mesh:
                vertex components: {comps}
                vertices: {verts}
                indices: {inds}
              """.format(
                comps=vertex_components,
                verts=len(data[1]),
                inds=len(data[2]))
              ))

        write_data(filepath, format_version, data, write_base64, write_json)

        print("Successfully exported!")
    else:
        print("Export failed.")

    return {'FINISHED'}


class ExportToC2G(bpy.types.Operator, ExportHelper):
    """Export to C2G binary format"""
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
    #in_world_cs = BoolProperty(
    #        name="Export in World CS",
    #        description="Export objects in world coordinate system",
    #        default=False,
    #        )

    format_version = EnumProperty(
            name="Version Format",
            description="Select C2G binary format version",
            items=(('0001', "v0.1", "Version 0.1"),
                   ),
            default='0001',
            )

    vertex_order = EnumProperty(
            name="Draw Mode",
            description="Order of vertices for drawing",
            items=(('GL_TRIANGLES', "GL_TRIANGLES", 
                    "GL_TRIANGLES OpenGL drawing mode"),
                   ),
            default='GL_TRIANGLES',
            )

    write_base64 = BoolProperty(
            name="Export in Base64",
            description="Also export Base64-encoded binary",
            default=False,
            )

    write_json = BoolProperty(
            name="Export in JSON",
            description="Also export JSON-encoded text",
            default=False,
            )

    @classmethod
    def poll(cls, context):
        return context.active_object is not None

    def execute(self, context):
        return export_to_c2g(context, self.filepath, 
            self.format_version, 
            self.write_base64,
            self.write_json)


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
    #bpy.ops.export.c2g('INVOKE_DEFAULT')
