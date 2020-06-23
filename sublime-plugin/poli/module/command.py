import re
import sublime

from poli.comm import comm
from poli.module.operation import EditContext
from poli.module.operation import cursor_location_at_sel
from poli.module.operation import edit_cxt_for
from poli.module.operation import edit_region_for
from poli.module.operation import module_contents
from poli.module.operation import reg_no_trailing_nl
from poli.module.operation import reg_plus_trailing_nl
from poli.module.operation import selected_region
from poli.sublime import regedit
from poli.sublime.command import InterruptibleTextCommand
from poli.sublime.command import TextCommand
from poli.sublime.misc import Marker
from poli.sublime.misc import insert
from poli.sublime.misc import read_only_set_to
from poli.sublime.selection import set_selection


__all__ = [
    'PoliSelect', 'PoliEdit', 'PoliAdd', 'PoliRename', 'PoliCancel', 'PoliCommit',
    'PoliDelete', 'PoliMoveBy1', 'PoliMoveHere'
]


class PoliSelect(TextCommand):
    def run(self, edit):
        loc = cursor_location_at_sel(self.view)
        set_selection(self.view, to=loc.entry.reg_entry)


class PoliEdit(TextCommand):
    def run(self, edit):
        loc = cursor_location_at_sel(self.view)
        if not loc.is_def_targeted:
            sublime.status_message("Cursor is not placed over definition")
            return

        regedit.establish(self.view, loc.entry.reg_def, edit_region_for)
        edit_cxt_for[self.view] = EditContext(
            name=loc.entry.name(),
            target='defn'
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.entry.reg_def)


class PoliRename(TextCommand):
    def run(self, edit):
        loc = cursor_location_at_sel(self.view)
        if not loc.is_name_targeted:
            sublime.status_message("Cursor is not placed over entry name")
            return

        regedit.establish(self.view, loc.entry.reg_name, edit_region_for)
        edit_cxt_for[self.view] = EditContext(
            name=loc.entry.name(),
            target='name'
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.entry.reg_name)


class PoliAdd(TextCommand):
    def run(self, edit, before):
        loc = cursor_location_at_sel(self.view)
        entry = loc.entry
        name = entry.name()
        self.view.set_read_only(False)
        insert_pos = entry.reg_name.begin() if before else entry.reg_def_nl.end()
        reg_new = insert(self.view, edit, insert_pos, "name ::= definition\n")
        reg_new = reg_no_trailing_nl(reg_new)
        set_selection(self.view, to=reg_new, show=True)

        regedit.establish(self.view, reg_new, edit_region_for)
        
        edit_cxt_for[self.view] = EditContext(
            name=name,
            target='entry',
            is_before=before
        )


class PoliCancel(TextCommand):
    def run(self, edit):
        if not regedit.is_active_in(self.view):
            return  # Protected by keymap context

        cxt = edit_cxt_for[self.view]
        if cxt.target == 'defn':
            defn = comm.get_defn(cxt.name)
            self.view.replace(edit, edit_region_for[self.view], defn)
        elif cxt.target == 'name':
            self.view.replace(edit, edit_region_for[self.view], cxt.name)
        else:
            assert cxt.target == 'entry'
            reg = reg_plus_trailing_nl(edit_region_for[self.view])
            self.view.set_read_only(False)
            self.view.erase(edit, reg)

        del edit_cxt_for[self.view]
        regedit.discard(self.view, read_only=True)


class PoliCommit(TextCommand):
    def run(self, edit):
        if not regedit.is_active_in(self.view):
            return  # Protected by keymap context

        cxt = edit_cxt_for[self.view]
        reg = edit_region_for[self.view]

        if cxt.target == 'defn':
            if reg.empty():
                sublime.status_message("Empty definition not allowed")
                return
            defn = self.view.substr(reg)
            comm.edit(cxt.name, defn)
        elif cxt.target == 'name':
            new_name = self.view.substr(reg)
            if not re.search('^[a-zA-Z_$][0-9a-zA-Z_$]*$', new_name):
                sublime.status_message("Not a valid name")
                return
            comm.rename(cxt.name, new_name)
        else:
            assert cxt.target == 'entry'
            
            mtch = re.search('^([a-zA-Z_$][0-9a-zA-Z_$]*) ::= (.+)$',
                             self.view.substr(reg),
                             re.DOTALL)
            if mtch is None:
                sublime.status_message("Invalid entry definition")
                return

            comm.add(
                name=mtch.group(1),
                defn=mtch.group(2),
                anchor=cxt.name,
                before=cxt.is_before
            )

        del edit_cxt_for[self.view]
        regedit.discard(self.view, read_only=True)

        self.view.run_command('save')


class PoliDelete(TextCommand):
    def run(self, edit):
        loc = cursor_location_at_sel(self.view)
        if not loc.is_fully_selected:
            sublime.status_message("Cannot determine what to delete")
            return

        comm.delete(loc.entry.name())
        with read_only_set_to(self.view, False):
            self.view.erase(edit, loc.entry.reg_entry_nl)

        self.view.run_command('save')


class PoliMoveBy1(TextCommand):
    def run(self, edit, direction):
        mcont = module_contents(self.view)
        loc = mcont.cursor_location_at(selected_region(self.view))
        if not loc.is_fully_selected:
            sublime.status_message("Cannot determine what to move")
            return

        comm.move_by_1(loc.entry.name(), direction)

        # OK, now synchronize the view itself       
        i = loc.entry.myindex

        if direction == 'up':
            if i == 0:
                insert_at = mcont.entries[-1].reg_entry_nl.end()
            else:
                insert_at = mcont.entries[i - 1].reg_entry_nl.begin()
        else:
            if i + 1 == len(mcont.entries):
                insert_at = 0
            else:
                insert_at = mcont.entries[i + 1].reg_entry_nl.end()

        with read_only_set_to(self.view, False), \
                Marker(self.view, insert_at) as insert_marker:
            text = loc.entry.contents_nl()
            self.view.erase(edit, loc.entry.reg_entry_nl)
            reg_new = insert(self.view, edit, insert_marker.pos, text)
            set_selection(self.view, to=reg_no_trailing_nl(reg_new), show=True)

        self.view.run_command('save')


class PoliMoveHere(InterruptibleTextCommand):
    def run(self, edit, callback, before):
        mcont = module_contents(self.view)
        loc = mcont.cursor_location_at(selected_region(self.view))
        dest_entry_name = loc.entry.name()
        entry_names = comm.get_entry_names()
        entry_names.remove(dest_entry_name)

        self.view.window().show_quick_panel(entry_names, callback)
        (idx,) = yield

        if idx == -1:
            return

        src_entry_name = entry_names[idx]
        comm.move(
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
            text = src_entry.contents_nl()
            self.view.erase(edit, src_entry.reg_entry_nl)
            reg_new = insert(self.view, edit, insert_marker.pos, text)
            set_selection(self.view, to=reg_no_trailing_nl(reg_new), show=True)

        self.view.run_command('save')
