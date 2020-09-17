import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.module.shared import ModuleTextCommand
from poli.module.import_section import parse_import_section


__all__ = ['PoliReplaceUsages', 'PoliConvertImportsToStar']


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


class PoliConvertImportsToStar(ModuleTextCommand):
    def run(self, edit, donor_module):
        modules_data = comm.convert_imports_to_star(
            op.poli_module_name(self.view),
            donor_module
        )
        op.modify_and_save_modules(self.view.window(), modules_data)

    def input(self, args):
        return DonorModuleInputHandler(self.view)


class DonorModuleInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, view):
        impsec = parse_import_section(view)
        self.items = [rec.module_name for rec in impsec.recs if rec.is_star]

    def list_items(self):
        return self.items
