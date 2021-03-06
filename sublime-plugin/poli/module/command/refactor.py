import sublime_plugin

from .shared import ModuleTextCommand

from poli.comm import comm
from poli.module import operation as op


__all__ = ['PoliReplaceUsages', 'PoliConvertImportsToStar']


class PoliReplaceUsages(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, name, new_name):
        res = comm.op('replaceUsages', {
            'module': op.view_module_name(self.view),
            'name': name,
            'newName': new_name
        })
        op.modify_module(self.view, edit, res)
        op.save_module(self.view)

    def input(self, args):
        return NameInputHandler(op.view_module_name(self.view))


class NameInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, module):
        self.module = module
        self.names = comm.op('getModuleNames', {'module': module})

    def list_items(self):
        return self.names

    def next_input(self, args):
        return NewNameInputHandler(self.names, args['name'])


class NewNameInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, names, except_name):
        self.names = [n for n in names if n != except_name]

    def list_items(self):
        return self.names


class PoliConvertImportsToStar(ModuleTextCommand):
    def run(self, edit, donor_module):
        comm.op('convertImportsToStar', {
            'recp': op.view_module_name(self.view),
            'donor': donor_module
        })

    def input(self, args):
        return DonorModuleInputHandler(self.view)


class DonorModuleInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, view):
        impsec = op.parse_import_section(view)
        self.items = [rec.module_name for rec in impsec.recs if rec.is_star]

    def list_items(self):
        return self.items
