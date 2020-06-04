import sublime
import sublime_plugin

from poli.comm import comm
from poli.repl.operation import insert_prompt
from poli.repl.operation import make_repl_view
from poli.sublime import regedit
from poli.sublime.misc import end_strip_region
from poli.sublime.selection import set_selection


__all__ = ['PoliReplOpen', 'PoliReplSend']


class PoliReplOpen(sublime_plugin.WindowCommand):
    def run(self):
        view = make_repl_view(self.window)
        self.window.focus_view(view)


class PoliReplSend(sublime_plugin.TextCommand):
    def run(self, edit):
        if not regedit.is_active_in(self.view):
            return   # Protected by keymap binding

        reg = regedit.editing_region(self.view)
        reg_stripped = end_strip_region(self.view, reg)

        if reg_stripped.empty():
            sublime.status_message("Empty prompt")
            return

        if reg.end() > reg_stripped.end():
            self.view.erase(edit, sublime.Region(reg_stripped.end(), reg.end()))
            reg = reg_stripped

        code = self.view.substr(reg)
        res = comm.eval(code=code)
        
        self.view.insert(edit, self.view.size(), '\n< ')
        self.view.insert(edit, self.view.size(), res)
        self.view.insert(edit, self.view.size(), '\n')

        insert_prompt(self.view)

        regedit.establish(self.view, sublime.Region(self.view.size()))
