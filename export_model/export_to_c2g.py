import bpy


def export_to_c2g(context, filepath, use_some_setting):
    print("running write_some_data...")
    f = open(filepath, 'w')
    f.write("Hello World %s" % use_some_setting)
    f.close()

    return {'FINISHED'}


# ExportHelper is a helper class, defines filename and
# invoke() function which calls the file selector.
from bpy_extras.io_utils import ExportHelper
from bpy.props import StringProperty, BoolProperty, EnumProperty


class ExportToC2G(bpy.types.Operator, ExportHelper):
    '''This appears in the tooltip of the operator and in the generated docs.'''
    bl_idname = "export.c2g"  # this is important since its how bpy.ops.export.some_data is constructed
    bl_label = "Export to C2G Binary"

    # ExportHelper mixin class uses this
    filename_ext = ".c2g"

    filter_glob = StringProperty(
            default="*.c2g",
            options={'HIDDEN'},
            )

    # List of operator properties, the attributes will be assigned
    # to the class instance from the operator settings before calling.
    use_setting = BoolProperty(
            name="Example Boolean",
            description="Example Tooltip",
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
        return export_to_c2g(context, self.filepath, self.format_version)


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
    register()

    # test call
    bpy.ops.export.c2g('INVOKE_DEFAULT')
