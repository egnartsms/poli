import re
import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.module.command import ModuleTextCommand



__all__ = ['PoliReplaceUsages']


class PoliReplaceUsages(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, name, new_name):
        res = comm.replace_usages(op.poli_module_name(self.view), name, new_name)
        op.modify_module(self.view, edit, res)
        op.save_module(self.view)

    def input(self, args):
        return NameInputHandler(op.poli_module_name(self.view))


class NameInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, module):
        self.module = module
        self.names = comm.get_module_names(module)

    def list_items(self):
        return self.names

    def next_input(self, args):
        return NewNameInputHandler(self.names, args['name'])


class NewNameInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, names, except_name):
        self.names = [n for n in names if n != except_name]

    def list_items(self):
        return self.names
