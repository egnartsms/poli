import sublime
import sublime_plugin

from poli.comm import comm
from poli.module.command import ModuleTextCommand
from poli.module.operation import is_entry_name_valid
from poli.module.operation import module_body_start
from poli.module.operation import poli_module_name
from poli.module.operation import save_module
from poli.sublime.regedit import region_editing_suppressed


__all__ = ['PoliImport', 'PoliRemoveUnusedImports']


class PoliImport(ModuleTextCommand):
    def run(self, edit, entry, alias):
        module_name, entry_name = entry

        new_import_section = comm.import_(
            recp_module=poli_module_name(self.view),
            donor_module=module_name,
            name=entry_name,
            alias=alias,
        )

        with region_editing_suppressed(self.view):
            self.view.replace(
                edit,
                sublime.Region(0, module_body_start(self.view)),
                new_import_section
            )
            save_module(self.view)

    def input(self, args):
        return EntryInputHandler(poli_module_name(self.view))


class EntryInputHandler(sublime_plugin.ListInputHandler):
    def __init__(self, recp_module_name):
        res = comm.get_importables(recp_module_name)
        self.items = [
            ("{} ({})".format(entry, module), [module, entry])
            for module, entry in res['importables']
        ]
        self.disallowed_names = res['disallowedNames']

    def list_items(self):
        return self.items

    def next_input(self, args):
        module_name, entry_name = args['entry']
        return AliasInputHandler(entry_name, self.disallowed_names)


class AliasInputHandler(sublime_plugin.TextInputHandler):
    def __init__(self, entry_name, disallowed_names):
        self.entry_name = entry_name
        self.disallowed_names = disallowed_names

    def placeholder(self):
        return "Alias"

    def validate(self, value):
        if value and not is_entry_name_valid(value):
            return False

        imported_as = value or self.entry_name
        return imported_as not in self.disallowed_names

    def preview(self, value):
        if not self.validate(value):
            return "Name collision"
        else:
            return None


class PoliRemoveUnusedImports(ModuleTextCommand):
    def run(self, edit):
        res = comm.remove_unused_imports(poli_module_name(self.view))

        new_import_section = res['importSection']
        removed_count = res['removedCount']

        if removed_count > 0:
            with region_editing_suppressed(self.view):
                self.view.replace(
                    edit,
                    sublime.Region(0, module_body_start(self.view)),
                    new_import_section
                )
                save_module(self.view)

            sublime.status_message("Removed {} unused imports".format(removed_count))
        else:
            sublime.status_message("There are no unused imports in this module")
