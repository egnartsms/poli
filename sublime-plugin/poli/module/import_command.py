import sublime_plugin

from poli.comm import comm
from poli.module.command import ModuleTextCommand
from poli.module.operation import poli_module_name


__all__ = ['PoliImportFrom']


class PoliImportFrom(ModuleTextCommand):
    def run(self, edit, module_name, entry_name):
        new_import_section = comm.import_(
            poli_module_name(self.view), module_name, entry_name
        )
        print(new_import_section)

    def input(self, args):
        return ModuleNameInputHandler(poli_module_name(self.view))


class ModuleNameInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, recp_module_name):
        self.recp_module_name = recp_module_name

    def list_items(self):
        return comm.get_module_names()

    def next_input(self, args):
        return EntryNameInputHandler(self.recp_module_name, args['module_name'])


class EntryNameInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, recp_module_name, donor_module_name):
        self.recp_module_name = recp_module_name
        self.donor_module_name = donor_module_name

    def list_items(self):
        importable_entries = comm.get_importable_entries(
            recp_module=self.recp_module_name,
            donor_module=self.donor_module_name
        )

        return importable_entries
