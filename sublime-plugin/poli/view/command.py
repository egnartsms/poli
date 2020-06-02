import re
import sublime
import sublime_plugin

from poli.comm import comm
from poli.sublime.region_edit import is_region_editing
from poli.sublime.region_edit import start_region_editing
from poli.sublime.region_edit import stop_region_editing
from poli.sublime.selection import set_selection
from poli.view.operation import EditContext
from poli.view.operation import edit_cxt_for
from poli.view.operation import edit_region
from poli.view.operation import entry_location_at


__all__ = ['PoliSelect', 'PoliEdit', 'PoliRename', 'PoliCancel', 'PoliCommit']


class PoliSelect(sublime_plugin.TextCommand):
    def run(self, edit):
        if is_region_editing(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to select (multiple cursors)")
            return

        loc = entry_location_at(self.view, self.view.sel()[0])
        if loc is None:
            sublime.status_message("Nothing to select")
            return

        set_selection(self.view, to=loc.reg_entry)


class PoliEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if is_region_editing(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to edit (multiple cursors)")
            return

        [reg] = self.view.sel()
        loc = entry_location_at(self.view, reg)
        
        if loc is None or not loc.is_defn_targeted:
            sublime.status_message("Cannot determine what to edit")
            return

        start_region_editing(self.view, loc.reg_defn, edit_region)
        edit_cxt_for[self.view] = EditContext(
            name=self.view.substr(loc.reg_name),
            is_editing_defn=True
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.reg_defn)


class PoliRename(sublime_plugin.TextCommand):
    def run(self, edit):
        if is_region_editing(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to rename (multiple cursors)")
            return

        [reg] = self.view.sel()
        loc = entry_location_at(self.view, reg)
        if loc is None or not loc.is_name_targeted:
            sublime.status_message("Cannot determine what to rename")
            return

        start_region_editing(self.view, loc.reg_name, edit_region)
        edit_cxt_for[self.view] = EditContext(
            name=self.view.substr(loc.reg_name),
            is_editing_defn=False
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.reg_name)


class PoliCancel(sublime_plugin.TextCommand):
    def run(self, edit):
        if not is_region_editing(self.view):
            return  # Protected by keymap context

        cxt = edit_cxt_for[self.view]
        if cxt.is_editing_defn:
            defn = comm.get_defn(cxt.name)
            self.view.replace(edit, edit_region[self.view], defn)
        else:
            self.view.replace(edit, edit_region[self.view], cxt.name)

        del edit_cxt_for[self.view]
        stop_region_editing(self.view, read_only=True)


class PoliCommit(sublime_plugin.TextCommand):
    def run(self, edit):
        if not is_region_editing(self.view):
            return  # Protected by keymap context

        cxt = edit_cxt_for[self.view]
        reg = edit_region[self.view]

        if cxt.is_editing_defn:
            if reg.empty():
                sublime.status_message("Empty definition not allowed")
                return

            defn = self.view.substr(reg)
            comm.edit(cxt.name, defn)
        else:
            new_name = self.view.substr(reg)
            if not re.search('^[a-zA-Z_$][0-9a-zA-Z_$]*$', new_name):
                sublime.status_message("Not a valid name")
                return

            comm.rename(cxt.name, new_name)

        del edit_cxt_for[self.view]
        stop_region_editing(self.view, read_only=True)

        self.view.run_command('save')
