import re
import sublime

from poli.comm import comm
from poli.module.command import ModuleInterruptibleTextCommand
from poli.module.command import ModuleTextCommand
from poli.module.operation import add_warnings
from poli.module.operation import edit_cxt_for
from poli.module.operation import edit_mode_info
from poli.module.operation import edit_region_for
from poli.module.operation import enter_edit_mode
from poli.module.operation import exit_edit_mode
from poli.module.operation import highlight_unknown_names
from poli.module.operation import is_entry_name_valid
from poli.module.operation import module_contents
from poli.module.operation import poli_file_name
from poli.module.operation import poli_module_name
from poli.module.operation import reg_no_trailing_nl
from poli.module.operation import reg_plus_trailing_nl
from poli.module.operation import replace_import_section
from poli.module.operation import save_module
from poli.module.operation import sel_cursor_location
from poli.module.operation import selected_region
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.misc import Marker
from poli.sublime.misc import end_strip_region
from poli.sublime.misc import insert_in
from poli.sublime.misc import read_only_as_transaction
from poli.sublime.misc import read_only_set_to
from poli.sublime.misc import replace_in
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import ViewDict
from poli.sublime.view_dict import on_any_view_load


__all__ = [
    'PoliSelect', 'PoliEdit', 'PoliAdd', 'PoliRename', 'PoliCancel', 'PoliCommit',
    'PoliDelete', 'PoliDeleteCascade', 'PoliMoveBy1', 'PoliMoveHere'
]


class PoliSelect(ModuleTextCommand):
    def run(self, edit):
        loc = sel_cursor_location(self.view)
        set_selection(self.view, to=loc.entry.reg_entry)


class PoliEdit(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = sel_cursor_location(self.view)
        if not loc.is_def_targeted:
            sublime.status_message("Cursor is not placed over definition")
            return

        enter_edit_mode(
            self.view, loc.entry.reg_def, target='defn', name=loc.entry.name()
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.entry.reg_def)


class PoliRename(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = sel_cursor_location(self.view)
        if not loc.is_name_targeted:
            sublime.status_message("Cursor is not placed over entry name")
            return

        enter_edit_mode(
            self.view, loc.entry.reg_name, target='name', name=loc.entry.name()
        )

        # if loc.is_fully_selected:
        #     set_selection(self.view, to=loc.entry.reg_name)


class PoliAdd(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, before):
        loc = sel_cursor_location(self.view)
        entry = loc.entry
        name = entry.name()
        self.view.set_read_only(False)
        insert_pos = entry.reg_name.begin() if before else entry.reg_def_nl.end()
        reg_new = insert_in(self.view, edit, insert_pos, "name ::= definition\n")
        reg_new = reg_no_trailing_nl(reg_new)
        set_selection(self.view, to=reg_new, show=True)

        enter_edit_mode(self.view, reg_new, target='entry', name=name, is_before=before)


class PoliCancel(ModuleTextCommand):
    only_in_mode = 'edit'

    def run(self, edit):
        cxt = edit_cxt_for[self.view]
        reg = edit_region_for[self.view]

        with read_only_as_transaction(self.view, False):
            if cxt.target == 'defn':
                defn = comm.get_defn(poli_module_name(self.view), cxt.name)
                self.view.replace(edit, reg, defn)
            elif cxt.target == 'name':
                self.view.replace(edit, reg, cxt.name)
            else:
                assert cxt.target == 'entry'
                reg = reg_plus_trailing_nl(reg)
                self.view.erase(edit, reg)

            exit_edit_mode(self.view)


RE_DEFN = r'^(?P<name>[a-zA-Z_][0-9a-zA-Z_]*) ::= (?P<defn>.+)$'


class PoliCommit(ModuleTextCommand):
    only_in_mode = 'edit'

    def run(self, edit):
        cxt = edit_cxt_for[self.view]
        reg = edit_region_for[self.view]
        original_reg = reg

        if cxt.target == 'defn':
            reg = end_strip_region(self.view, reg)
            if reg.empty():
                sublime.status_message("Empty definition not allowed")
                return
            defn = self.view.substr(reg)
            comm.edit(poli_module_name(self.view), cxt.name, defn)
        elif cxt.target == 'name':
            new_name = self.view.substr(reg)
            if not is_entry_name_valid(new_name):
                sublime.status_message("Not a valid name")
                return
            comm.rename(poli_module_name(self.view), cxt.name, new_name)
        else:
            assert cxt.target == 'entry'
            
            reg = end_strip_region(self.view, reg)
            mtch = re.search(RE_DEFN, self.view.substr(reg), re.DOTALL)
            if mtch is None:
                sublime.status_message("Invalid entry definition")
                return

            comm.add(
                module=poli_module_name(self.view),
                name=mtch.group('name'),
                defn=mtch.group('defn'),
                anchor=cxt.name,
                before=cxt.is_before
            )

        save_module(self.view)

        whitespace_reg = sublime.Region(reg.end(), original_reg.end())
        if not whitespace_reg.empty():
            self.view.set_read_only(False)
            self.view.erase(edit, whitespace_reg)

        exit_edit_mode(self.view)


class PoliDelete(ModuleTextCommand):
    def run(self, edit):
        loc = sel_cursor_location(self.view, require_fully_selected=True)
        ok = comm.delete(poli_module_name(self.view), loc.entry.name())
        if not ok:
            sublime.status_message(
                "Cannot delete \"{}\" as it is imported in other modules".format(
                    loc.entry.name()
                )
            )
            return

        with read_only_set_to(self.view, False):
            self.view.erase(edit, loc.entry.reg_entry_nl)

        save_module(self.view)


class PoliDeleteCascade(ModuleTextCommand):
    def run(self, edit):
        loc = sel_cursor_location(self.view, require_fully_selected=True)
        res = comm.delete_cascade(poli_module_name(self.view), loc.entry.name())

        with read_only_set_to(self.view, False):
            self.view.erase(edit, loc.entry.reg_entry_nl)

        save_module(self.view)

        window = self.view.window()
        views = [
            window.open_file(poli_file_name(module_name))
            for module_name in res
        ]
        view_data = ViewDict(zip(views, res.values()))

        def process_view(view, edit):
            replace_import_section(view, edit, view_data[view])
            save_module(view)

        on_any_view_load(
            views,
            lambda view: call_with_edit(view, lambda edit: process_view(view, edit))
        )


class PoliMoveBy1(ModuleTextCommand):
    def run(self, edit, direction):
        mcont = module_contents(self.view)
        loc = mcont.cursor_location_or_stop(
            selected_region(self.view), require_fully_selected=True
        )
        comm.move_by_1(poli_module_name(self.view), loc.entry.name(), direction)

        # OK, now synchronize the view itself
        i = loc.entry.myindex

        if direction == 'up':
            if i == 0:
                insert_at = mcont.entries[-1].reg_entry_nl.end()
            else:
                insert_at = mcont.entries[i - 1].reg_entry_nl.begin()
        else:
            if i + 1 == len(mcont.entries):
                insert_at = mcont.body_start
            else:
                insert_at = mcont.entries[i + 1].reg_entry_nl.end()

        with read_only_set_to(self.view, False), \
                Marker(self.view, insert_at) as insert_marker:
            text = loc.entry.contents()
            self.view.erase(edit, loc.entry.reg_entry_nl)
            reg_new = insert_in(self.view, edit, insert_marker.pos, text)
            self.view.insert(edit, reg_new.end(), '\n')
            set_selection(self.view, to=reg_new, show=True)

        save_module(self.view)


class PoliMoveHere(ModuleInterruptibleTextCommand):
    def run(self, edit, callback, before):
        mcont = module_contents(self.view)
        loc = mcont.cursor_location_or_stop(selected_region(self.view))
        dest_entry_name = loc.entry.name()
        entry_names = comm.get_entries(poli_module_name(self.view))
        entry_names.remove(dest_entry_name)

        self.view.window().show_quick_panel(entry_names, callback)
        (idx,) = yield

        if idx == -1:
            return

        src_entry_name = entry_names[idx]
        comm.move(
            module=poli_module_name(self.view),
            src=src_entry_name,
            dest=dest_entry_name,
            before=before
        )

        # Synchronize the view
        if before:
            insert_at = loc.entry.reg_entry_nl.begin()
        else:
            insert_at = loc.entry.reg_entry_nl.end()

        with read_only_set_to(self.view, False), \
                Marker(self.view, insert_at) as insert_marker:
            src_entry = mcont.entry_by_name(src_entry_name)
            text = src_entry.contents()
            self.view.erase(edit, src_entry.reg_entry_nl)
            reg_new = insert_in(self.view, edit, insert_marker.pos, text)
            self.view.insert(edit, reg_new.end(), '\n')
            set_selection(self.view, to=reg_new, show=True)

        save_module(self.view)
