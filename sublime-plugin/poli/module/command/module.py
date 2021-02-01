import os
import re
import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.shared.command import ApplicationCommand
from poli.sublime import regedit

from .shared import ModuleTextCommand


__all__ = ['PoliAddNewModule', 'PoliRenameModule', 'PoliRefreshModule', 'PoliRemoveModule']


class PoliAddNewModule(ApplicationCommand):
    def run(self, module_name):
        try:
            with open(op.js_module_filename(module_name), 'x') as file:
                file.write('-----\n')
        except FileExistsError:
            sublime.error_message("Module file already exists")

        comm.op('addModule', {'module': module_name})
        sublime.active_window().open_file(op.js_module_filename(module_name))

    def input(self, args):
        return ModuleNameInputHandler(comm.op('getModules', {}))


class PoliRenameModule(ModuleTextCommand):
    def run(self, edit, module_name):
        res = comm.op('renameModule', {
            'module': op.js_module_name(self.view),
            'newName': module_name
        })
        new_file_name = op.js_module_filename(module_name)
        os.rename(self.view.file_name(), new_file_name)
        self.view.retarget(new_file_name)
        op.replace_import_section_in_modules(self.view.window(), res)

    def input(self, args):
        return ModuleNameInputHandler(comm.op('getModules', {}))


class ModuleNameInputHandler(sublime_plugin.TextInputHandler):
    def __init__(self, existing_module_names):
        self.existing_module_names = existing_module_names

    def preview(self, value):
        valid = re.search(r'^[a-zA-Z-][0-9a-zA-Z-]*$', value) is not None
        if not valid:
            return "Not a valid module name"

        if value in self.existing_module_names:
            return "Module with this name already exists"

        return None

    def validate(self, value):
        return self.preview(value) is None


class PoliRefreshModule(ModuleTextCommand):
    def run(self, edit):
        if regedit.is_active_in(self.view):
            ok = sublime.ok_cancel_dialog("Unsaved changes would be lost. Continue?")
            if not ok:
                return
            op.terminate_edit_mode(self.view)

        comm.op('refreshModule', {'module': op.js_module_name(self.view)})


class PoliRemoveModule(ModuleTextCommand):
    def run(self, edit):
        remove = sublime.ok_cancel_dialog(
            "Remove module '{}'?".format(op.js_module_name(self.view))
        )
        if not remove:
            return

        res = comm.op('removeModule', {
            'module': op.js_module_name(self.view),
            'force': False
        })
        if res is not True:
            remove = sublime.ok_cancel_dialog(
                "Module '{}' is connected with these modules: {}. Force removal?".format(
                    op.js_module_name(self.view), ', '.join(res)
                )
            )
            if not remove:
                return

            res = comm.op('removeModule', {
                'module': op.js_module_name(self.view),
                'force': True
            })
            if res is not True:
                sublime.error_message("Could not delete module, returned: {}".format(res))
                return

        file_name = self.view.file_name()
        self.view.close()
        os.unlink(file_name)
