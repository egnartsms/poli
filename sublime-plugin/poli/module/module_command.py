import re
import sublime_plugin

from poli.sublime.command import ApplicationCommand


__all__ = ['PoliAddNewModule']


class PoliAddNewModule(ApplicationCommand):
    def run(self, module_name):
        print("New module name is:", module_name)

    def input(self, args):
        return ModuleNameInputHandler()


class ModuleNameInputHandler(sublime_plugin.TextInputHandler):
    def validate(self, text):
        return re.search(r'^[0-9a-zA-Z]+$', text) is not None
