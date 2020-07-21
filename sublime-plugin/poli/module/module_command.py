import re
import sublime_plugin

from poli.comm import comm
from poli.sublime.command import ApplicationCommand


__all__ = ['PoliAddNewModule']


class PoliAddNewModule(ApplicationCommand):
    def run(self, module_name):
        print("New module name is:", module_name)

    def input(self, args):
        return ModuleNameInputHandler(comm.get_module_names())


class ModuleNameInputHandler(sublime_plugin.TextInputHandler):
    def __init__(self, existing_module_names):
        self.existing_module_names = existing_module_names

    def validate(self, text):
        valid = re.search(r'^[0-9a-zA-Z-]+$', text) is not None
        return valid and text not in self.existing_module_names
