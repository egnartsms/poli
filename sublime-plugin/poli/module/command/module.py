import os
import re
import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.shared.command import ApplicationCommand
from poli.sublime import regedit
from poli.sublime.input import ChainableInputHandler
from poli.sublime.input import chain_input_handlers

from .shared import ModuleTextCommand


__all__ = ['PoliAddNewModule', 'PoliRenameModule', 'PoliRefreshModule', 'PoliRemoveModule']


class PoliAddNewModule(ApplicationCommand):
    def run(self, module_name, lang):
        try:
            with open(op.module_filename(module_name, lang), 'x') as file:
                file.write('-----\n')
        except FileExistsError:
            sublime.error_message("Module file already exists")

        comm.op('addModule', {
            'module': module_name,
            'lang': lang
        })
        sublime.active_window().open_file(op.module_filename(module_name, lang))

    def input(self, args):
        return chain_input_handlers(None, args, [
            ModuleNameInputHandler,
            LangInputHandler
        ])


class PoliRenameModule(ModuleTextCommand):
    def run(self, edit, module_name):
        comm.op('renameModule', {
            'module': op.view_module_name(self.view),
            'newName': module_name
        })
        new_file_name = op.module_filename(module_name, op.view_lang(self.view))
        os.rename(self.view.file_name(), new_file_name)
        self.view.retarget(new_file_name)

    def input(self, args):
        return chain_input_handlers(self.view, args, [ModuleNameInputHandler])


class ModuleNameInputHandler(ChainableInputHandler, sublime_plugin.TextInputHandler):
    def __init__(self, view, args, chain_tail):
        super().__init__(view, chain_tail)
        self.existing_module_names = comm.op('getModules', {})

    def preview(self, value):
        valid = re.search(r'^[a-zA-Z-][0-9a-zA-Z-]*$', value) is not None
        if not valid:
            return "Not a valid module name"

        if value in self.existing_module_names:
            return "Module with this name already exists"

        return None

    def validate(self, value):
        return self.preview(value) is None


class LangInputHandler(ChainableInputHandler, sublime_plugin.ListInputHandler):
    def __init__(self, view, args, chain_tail):
        super().__init__(view, chain_tail)

    def list_items(self):
        return [('JS', 'js'), ('XS', 'xs')]


class PoliRefreshModule(ModuleTextCommand):
    def run(self, edit):
        if regedit.is_active_in(self.view):
            ok = sublime.ok_cancel_dialog("Unsaved changes would be lost. Continue?")
            if not ok:
                return
            op.terminate_edit_mode(self.view)

        comm.op('refreshModule', {'module': op.view_module_name(self.view)})


class PoliRemoveModule(ModuleTextCommand):
    def run(self, edit):
        remove = sublime.ok_cancel_dialog(
            "Remove module '{}'?".format(op.view_module_name(self.view))
        )
        if not remove:
            return

        res = comm.op('removeModule', {
            'module': op.view_module_name(self.view),
            'force': False
        })
        if res is not True:
            remove = sublime.ok_cancel_dialog(
                "Module '{}' is connected with these modules: {}. Force removal?".format(
                    op.view_module_name(self.view), ', '.join(res)
                )
            )
            if not remove:
                return

            res = comm.op('removeModule', {
                'module': op.view_module_name(self.view),
                'force': True
            })
            if res is not True:
                sublime.error_message("Could not delete module, returned: {}".format(res))
                return

        file_name = self.view.file_name()
        self.view.close()
        os.unlink(file_name)
