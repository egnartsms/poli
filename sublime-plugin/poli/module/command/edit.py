import re
import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.shared.misc import single_selected_region
from poli.sublime.misc import insert_in
from poli.sublime.misc import read_only_set_to
from poli.sublime.misc import end_plus_1
from poli.sublime.selection import set_selection

from .shared import ModuleTextCommand


__all__ = [
    'PoliSelect', 'PoliEdit', 'PoliAdd', 'PoliRename', 'PoliCancel', 'PoliCommit',
    'PoliRemove', 'PoliMess'
]


class PoliMess(sublime_plugin.TextCommand):
    def run(self, edit):
        for i in reversed(range(10)):
            self.view.erase(edit, sublime.Region(100 * i, 100 * i + 20))
        self.view.add_regions('fuck', [sublime.Region(200, 300)], 'reddish', '', 0)
        raise RuntimeError


class PoliSelect(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = op.sel_cursor_location(self.view)
        set_selection(self.view, to=loc.entry.reg)


class PoliEdit(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = op.sel_cursor_location(self.view)
        if not loc.is_def_targeted:
            sublime.status_message("Cursor is not placed over definition")
            return

        op.enter_edit_mode(self.view, loc.entry.reg_def, adding_new=False)

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.entry.reg_def)


class PoliRename(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        reg = single_selected_region(self.view)
        if op.reg_import_section(self.view).contains(reg):
            raise NotImplementedError
            # TODO: implement import rename
            self.view.run_command('poli_rename_this_import')
            return

        loc = op.sel_cursor_location(self.view)
        if not loc.is_name_targeted:
            sublime.status_message("Cursor is not placed over entry name")
            return

        op.enter_edit_mode(self.view, loc.entry.reg_name, adding_new=False)


class PoliAdd(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, before):
        def insert_dummy_def(at):
            reg = insert_in(self.view, edit, at, "name ::= definition")
            self.view.insert(edit, reg.end(), "\n")
            set_selection(self.view, to=reg, show=True)
            return reg

        # In case the module is absolutely empty, take a different approach
        if op.reg_body(self.view).empty():
            self.view.set_read_only(False)
            reg_new = insert_dummy_def(at=self.view.size())
        else:
            loc = op.sel_cursor_location(self.view)
            entry_name = loc.entry.name()
            self.view.set_read_only(False)
            reg_new = insert_dummy_def(
                at=loc.entry.reg_nl.begin() if before else loc.entry.reg_nl.end()
            )
        
        op.enter_edit_mode(self.view, reg_new, adding_new=True)


class PoliCancel(ModuleTextCommand):
    only_in_mode = 'edit'

    def run(self, edit):
        cxt = op.edit_cxt_for[self.view]
        reg = op.edit_region_for[self.view]

        if cxt.adding_new:
            with op.quitting_edit_mode(self.view):
                self.view.erase(edit, end_plus_1(reg))
                return

        body = op.module_body(self.view)
        entry = body.entry_under_edit()

        if entry.is_def_under_edit():
            defn = comm.op('getDefinition', {
                'module': op.view_module_name(self.view),
                'name': entry.name()
            })
            with op.quitting_edit_mode(self.view):
                self.view.replace(edit, reg, defn)
        elif entry.is_name_under_edit():
            name = comm.op('getNameAt', {
                'module': op.view_module_name(self.view),
                'at': entry.myindex
            })
            with op.quitting_edit_mode(self.view):
                self.view.replace(edit, reg, name)
        else:
            raise RuntimeError


class PoliCommit(ModuleTextCommand):
    only_in_mode = 'edit'

    def run(self, edit):
        edit_region = op.edit_region_for[self.view]
        cxt = op.edit_cxt_for[self.view]
        body = op.module_body(self.view)

        if cxt.adding_new:
            index = body.remove_ephemeral_entry()
            templ = op.RE_FULL_ENTRY[op.view_lang(self.view)]
            
            mtch = re.search(templ, self.view.substr(edit_region), re.DOTALL)

            if mtch is None:
                sublime.status_message("Invalid entry definition")
                return

            if mtch.group('def').isspace():
                sublime.status_message("Empty definition not allowed")
                return

            comm.op(
                'addEntry',
                {
                    'module': op.view_module_name(self.view),
                    'name': mtch.group('name'),
                    'def': mtch.group('def'),
                    'index': index
                },
                committing_module_name=op.view_module_name(self.view)
            )
            return

        entry = body.entry_under_edit()

        if entry.is_def_under_edit():
            res = comm.op(
                'editEntry',
                {
                    'module': op.view_module_name(self.view),
                    'name': entry.name(),
                    'newDef': self.view.substr(edit_region)
                },
                committing_module_name=op.view_module_name(self.view)
            )
        elif entry.is_name_under_edit():
            comm.op(
                'renameEntry',
                {
                    'module': op.view_module_name(self.view),
                    'index': entry.myindex,
                    'newName': self.view.substr(edit_region)
                },
                committing_module_name=op.view_module_name(self.view)
            )
        else:
            raise RuntimeError


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
        res = comm.op('removeEntry', {
            'module': op.view_module_name(self.view),
            'entry': loc.entry.name(),
            'force': False
        })
        if not res['removed']:
            remove_anyway = sublime.ok_cancel_dialog(
                "Entry \"{}\" is being referred to. Remove it anyway?".format(
                    loc.entry.name()
                )
            )
            if not remove_anyway:
                return
            res = comm.op('removeEntry', {
                'module': op.view_module_name(self.view),
                'entry': loc.entry.name(),
                'force': True
            })

        if not res['removed']:
            raise RuntimeError

        with read_only_set_to(self.view, False):
            self.view.erase(edit, loc.entry.reg_entry_nl)

        op.save_module(self.view)
