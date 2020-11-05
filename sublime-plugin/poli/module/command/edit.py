import re
import sublime

from poli.comm import comm
from poli.module import op
from poli.shared.misc import single_selected_region
from poli.sublime.misc import end_strip_region
from poli.sublime.misc import insert_in
from poli.sublime.misc import read_only_as_transaction
from poli.sublime.misc import read_only_set_to
from poli.sublime.selection import set_selection

from .shared import ModuleTextCommand


__all__ = [
    'PoliSelect', 'PoliEdit', 'PoliAdd', 'PoliRename', 'PoliCancel', 'PoliCommit',
    'PoliRemove'
]


class PoliSelect(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = op.sel_cursor_location(self.view)
        set_selection(self.view, to=loc.entry.reg_entry)


class PoliEdit(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = op.sel_cursor_location(self.view)
        if not loc.is_def_targeted:
            sublime.status_message("Cursor is not placed over definition")
            return

        op.enter_edit_mode(
            self.view, loc.entry.reg_def, target='defn', name=loc.entry.name()
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.entry.reg_def)


class PoliRename(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        reg = single_selected_region(self.view)
        if op.reg_import_section(self.view).contains(reg):
            self.view.run_command('poli_rename_this_import')
            return

        loc = op.module_body(self.view).cursor_location_or_stop(reg)
        loc = op.sel_cursor_location(self.view)
        if not loc.is_name_targeted:
            sublime.status_message("Cursor is not placed over entry name")
            return

        op.enter_edit_mode(
            self.view, loc.entry.reg_name, target='name', name=loc.entry.name()
        )


class PoliAdd(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, before):
        def insert_dummy_def(at):
            reg_new = insert_in(self.view, edit, at, "name ::= definition\n")
            reg_new = op.reg_no_trailing_nl(reg_new)
            set_selection(self.view, to=reg_new, show=True)
            return reg_new

        # In case the module is absolutely empty, take a different approach
        if op.module_body_start(self.view) == self.view.size():
            self.view.set_read_only(False)
            reg_new = insert_dummy_def(at=self.view.size())
            op.enter_edit_mode(
                self.view, reg_new, target='entry', name=None, is_before=None
            )
        else:
            loc = op.sel_cursor_location(self.view)
            entry_name = loc.entry.name()
            self.view.set_read_only(False)
            reg_new = insert_dummy_def(
                at=(loc.entry.reg_entry_nl.begin() if before else
                    loc.entry.reg_entry_nl.end())
            )
            op.enter_edit_mode(
                self.view, reg_new, target='entry', name=entry_name, is_before=before
            )


class PoliCancel(ModuleTextCommand):
    only_in_mode = 'edit'

    def run(self, edit):
        cxt = op.edit_cxt_for[self.view]
        reg = op.edit_region_for[self.view]

        with read_only_as_transaction(self.view, False):
            if cxt.target == 'defn':
                defn = comm.get_defn(op.js_module_name(self.view), cxt.name)
                self.view.replace(edit, reg, defn)
            elif cxt.target == 'name':
                self.view.replace(edit, reg, cxt.name)
            else:
                assert cxt.target == 'entry'
                reg = op.reg_plus_trailing_nl(reg)
                self.view.erase(edit, reg)

            op.exit_edit_mode(self.view)


RE_DEFN = r'^(?P<name>[a-zA-Z_][0-9a-zA-Z_]*) ::= (?P<defn>.+)$'


class PoliCommit(ModuleTextCommand):
    only_in_mode = 'edit'

    def run(self, edit):
        cxt = op.edit_cxt_for[self.view]
        reg = op.edit_region_for[self.view]
        original_reg = reg

        if cxt.target == 'defn':
            reg = end_strip_region(self.view, reg)
            if reg.empty():
                sublime.status_message("Empty definition not allowed")
                return
            defn = self.view.substr(reg)
            comm.edit_entry(op.js_module_name(self.view), cxt.name, defn)
        elif cxt.target == 'name':
            new_name = self.view.substr(reg)
            if not op.is_entry_name_valid(new_name):
                sublime.status_message("Not a valid name")
                return
            res = comm.rename_entry(op.js_module_name(self.view), cxt.name, new_name)
            op.modify_and_save_modules(self.view.window(), res)
        else:
            assert cxt.target == 'entry'
            
            reg = end_strip_region(self.view, reg)
            mtch = re.search(RE_DEFN, self.view.substr(reg), re.DOTALL)
            if mtch is None:
                sublime.status_message("Invalid entry definition")
                return

            comm.add_entry(
                module=op.js_module_name(self.view),
                name=mtch.group('name'),
                defn=mtch.group('defn'),
                anchor=cxt.name,
                before=cxt.is_before
            )

        op.save_module(self.view)

        whitespace_reg = sublime.Region(reg.end(), original_reg.end())
        if not whitespace_reg.empty():
            self.view.set_read_only(False)
            self.view.erase(edit, whitespace_reg)

        op.exit_edit_mode(self.view)


class PoliRemove(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        reg = single_selected_region(self.view)
        if op.reg_import_section(self.view).contains(reg):
            self.view.run_command('poli_remove_this_import', {
                'force': False
            })
            return

        loc = op.module_body(self.view).cursor_location_or_stop(
            reg, require_fully_selected=True
        )
        modules_data = comm.remove_entry(op.js_module_name(self.view), loc.entry.name())
        if modules_data is None:
            sublime.error_message(
                "Cannot delete \"{}\" as it is being used by other modules".format(
                    loc.entry.name()
                )
            )
            return

        with read_only_set_to(self.view, False):
            self.view.erase(edit, loc.entry.reg_entry_nl)
        op.save_module(self.view)

        op.modify_and_save_modules(self.view.window(), modules_data)
