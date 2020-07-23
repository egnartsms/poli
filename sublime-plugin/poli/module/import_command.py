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

        self.importable_entries = comm.get_importable_entries(
            recp_module=recp_module_name,
            donor_module=donor_module_name
        )

    def list_items(self):
        return [entry for entry, possible in self.importable_entries]

    def validate(self, value):
        return self._is_possible(value)

    def preview(self, value):
        if self._is_possible(value):
            return None
        else:
            return "Cannot import (name collision)"

    def _is_possible(self, value):
        return next(
            possible for entry, possible in self.importable_entries if entry == value
        )