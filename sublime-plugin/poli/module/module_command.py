import os
import re
import sublime_plugin
import sublime

from poli.comm import comm
from poli.shared.command import ApplicationCommand
from poli import config
from poli.module import operation as op


__all__ = ['PoliAddNewModule']


class PoliAddNewModule(ApplicationCommand):
    def run(self, module_name):
        try:
            with open(op.poli_file_name(module_name), 'x') as file:
                file.write('-----\n')
        except FileExistsError:
            sublime.error_message("Module file already exists")

        comm.add_module(module_name)
        sublime.active_window().open_file(op.poli_file_name(module_name))

    def input(self, args):
        return ModuleNameInputHandler(comm.get_modules())


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
