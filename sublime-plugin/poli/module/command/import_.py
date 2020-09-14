import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.module.shared import ModuleTextCommand
from poli.shared.command import WindowCommand
from poli.sublime.input import ChainableInputHandler
from poli.sublime.input import chain_input_handlers
from poli.sublime.input import run_command_thru_palette
from poli.sublime.misc import single_selected_region


__all__ = [
    'PoliImport', 'PoliRenameImport', 'PoliRenameThisImport', 'PoliDeleteImport',
    'PoliDeleteThisImport', 'PoliRemoveUnusedImports',
    'PoliRemoveUnusedImportsInAllModules'
]


class AliasCommonHandler(ChainableInputHandler, sublime_plugin.TextInputHandler):
    def __init__(self, view, chain_tail, entry, disallowed_names):
        super().__init__(view, chain_tail)
        self.entry = entry
        self.disallowed_names = disallowed_names

    def placeholder(self):
        return "[alias]"

    def validate(self, value):
        return self.preview(value) is None

    def preview(self, value):
        if value and not op.is_entry_name_valid(value):
            return "Not a valid JavaScript name"

        imported_as = value or self.entry
        if not imported_as:
            return "Module import without an alias"

        if imported_as in self.disallowed_names:
            return "\"{}\" already defined or imported".format(imported_as)

        return None


class PoliImport(ModuleTextCommand):
    def run(self, edit, entry, alias):
        module_name, entry_name = entry

        new_import_section = comm.import_(
            recp_module=op.poli_module_name(self.view),
            donor_module=module_name,
            name=entry_name,
            alias=alias,
        )

        op.replace_import_section(self.view, edit, new_import_section)
        op.save_module(self.view)

    def input(self, args):
        return chain_input_handlers(self.view, args, [
            self.EntryInputHandler,
            self.AliasInputHandler
        ])

    class EntryInputHandler(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            res = comm.get_importables(op.poli_module_name(view))
            self.items = [
                ("{} ({})".format(entry or '*', module), [module, entry])
                for module, entry in res
            ]

        def list_items(self):
            return self.items

    class AliasInputHandler(AliasCommonHandler):
        def __init__(self, view, args, chain_tail):
            module_name, entry = args['entry']
            disallowed_names = comm.get_module_names(op.poli_module_name(view))
            super().__init__(view, chain_tail, entry, disallowed_names)


class PoliRenameImport(ModuleTextCommand):
    def run(self, edit, imported_as, new_alias):
        data = comm.rename_import(
            op.poli_module_name(self.view), imported_as, new_alias
        )
        op.modify_module(self.view, edit, data)
        op.save_module(self.view)

    def input(self, args):
        return chain_input_handlers(self.view, args, [
            self.ImportedAsInputHandler,
            self.NewAliasInputHandler
        ])

    class ImportedAsInputHandler(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            impsec = op.parse_import_section(view)
            self.imported_names = list(impsec.imported_names())

        def list_items(self):
            return self.imported_names

    class NewAliasInputHandler(AliasCommonHandler):
        def __init__(self, view, args, chain_tail):
            rec = op.parse_import_section(view).record_for_imported_name(
                args['imported_as']
            )
            if rec is None:
                raise RuntimeError
            disallowed_names = op.known_names(view)
            super().__init__(view, chain_tail, rec.name, disallowed_names)


class PoliRenameThisImport(ModuleTextCommand):
    def run(self, edit):
        reg = single_selected_region(self.view)
        rec = op.parse_import_section(self.view).record_at_or_stop(reg)

        run_command_thru_palette(self.view.window(), 'poli_rename_import', {
            'imported_as': rec.imported_as
        })


class PoliDeleteImport(ModuleTextCommand):
    def run(self, edit, imported_as, force):
        res = comm.remove_import(op.poli_module_name(self.view), imported_as, force)
        if not res['removed']:
            assert not force  # otherwise it would have deleted the import

            delete_anyway = sublime.ok_cancel_dialog(
                "The import \"{}\" is used. Force delete?".format(imported_as),
                "Delete"
            )
            if not delete_anyway:
                return

            res = comm.remove_import(op.poli_module_name(self.view), imported_as, True)
        
        op.replace_import_section(self.view, edit, res['importSection'])
        op.save_module(self.view)


class PoliDeleteThisImport(ModuleTextCommand):
    def run(self, edit, force):
        reg = single_selected_region(self.view)
        rec = op.parse_import_section(self.view).record_at_or_stop(reg)

        self.view.run_command('poli_delete_import', {
            'imported_as': rec.imported_as,
            'force': force
        })


class PoliRemoveUnusedImports(ModuleTextCommand):
    def run(self, edit):
        res = comm.remove_unused_imports(op.poli_module_name(self.view))

        new_import_section = res['importSection']
        removed_count = res['removedCount']

        if removed_count > 0:
            op.replace_import_section(self.view, edit, new_import_section)
            op.save_module(self.view)
            sublime.status_message("Removed {} unused imports".format(removed_count))
        else:
            sublime.status_message("There are no unused imports in this module")


class PoliRemoveUnusedImportsInAllModules(WindowCommand):
    def run(self):
        res = comm.remove_unused_imports_in_all_modules()

        modified_modules = res['modifiedModules']
        removed_count = res['removedCount']
        
        if removed_count > 0:
            op.modify_and_save_modules(self.window, modified_modules)
            sublime.status_message("Removed {} unused imports".format(removed_count))
        else:
            sublime.status_message("There are no unused imports in any module")
