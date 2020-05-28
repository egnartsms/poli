import sublime
import sublime_plugin

from poli.comm import comm
from poli.sublime.region_edit import is_region_editing
from poli.sublime.region_edit import start_region_editing
from poli.sublime.region_edit import stop_region_editing
from poli.view.operation import get_edit_region
from poli.view.operation import object_location
from poli.view.operation import set_edit_region


__all__ = ['PoliEdit', 'PoliCommitEdit']


class PoliEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if is_region_editing(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to edit (multiple cursors)")
            return

        loc = object_location(self.view, self.view.sel()[0])
        if loc is None:
            return

        reg = sublime.Region(loc.val.a + 1, loc.val.b - 1)
        start_region_editing(self.view, reg, get_edit_region, set_edit_region)


class PoliCommitEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if not is_region_editing(self.view):
            return  # Protected by keymap context

        reg = get_edit_region(self.view)
        loc = object_location(self.view, reg)
        new_src = self.view.substr(loc.val)
        key = self.view.substr(loc.key)
        comm.send_op('edit', {
            'key': key,
            'newSrc': new_src
        })
        stop_region_editing(self.view, read_only=True)
        self.view.erase_regions('edit')
