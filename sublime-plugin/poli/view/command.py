import sublime
import sublime_plugin

from poli.comm import comm
from poli.sublime.region_edit import is_region_editing
from poli.sublime.region_edit import start_region_editing
from poli.sublime.region_edit import stop_region_editing
from poli.sublime.selection import set_selection
from poli.view.operation import del_edit_region
from poli.view.operation import get_edit_region
from poli.view.operation import module_entry_at
from poli.view.operation import set_edit_region


__all__ = ['PoliSelect', 'PoliEdit', 'PoliCancelEdit', 'PoliCommitEdit']


class PoliSelect(sublime_plugin.TextCommand):
    def run(self, edit):
        if is_region_editing(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to select (multiple cursors)")
            return

        entry = module_entry_at(self.view, self.view.sel()[0])
        if entry is None:
            sublime.status_message("Nothing to select")
            return

        set_selection(self.view, to=entry.entry)


class PoliEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if is_region_editing(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to edit (multiple cursors)")
            return

        entry = module_entry_at(self.view, self.view.sel()[0])
        if entry is None:
            sublime.status_message("Nothing to edit")
            return

        start_region_editing(self.view, entry.defn, get_edit_region, set_edit_region,
                             del_edit_region)


class PoliCancelEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if not is_region_editing(self.view):
            return  # Protected by keymap context

        entry = module_entry_at(self.view, get_edit_region(self.view))
        name = self.view.substr(entry.name)
        defn = comm.get_defn(name)
        self.view.replace(edit, get_edit_region(self.view), defn)
        stop_region_editing(self.view, read_only=True)


class PoliCommitEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if not is_region_editing(self.view):
            return  # Protected by keymap context

        reg = get_edit_region(self.view)
        entry = module_entry_at(self.view, reg)
        if entry.defn.empty():
            sublime.status_message("Empty definition now allowed")
            return

        comm.edit(self.view.substr(entry.name), self.view.substr(entry.defn))
        stop_region_editing(self.view, read_only=True)
