import sublime
import sublime_plugin

from poli.comm import comm
from poli.exc import ReplEvalError
from poli.repl.operation import History
from poli.repl.operation import REPL_KIND
from poli.repl.operation import active_prompt_reg
from poli.repl.operation import current_prompt
from poli.repl.operation import insert_prompt_at_end
from poli.repl.operation import make_repl_view
from poli.repl.operation import poli_cur_module
from poli.shared.command import KindSpecificTextCommand
from poli.shared.setting import poli_kind
from poli.sublime import regedit
from poli.sublime.command import InterruptibleTextCommand
from poli.sublime.command import TextCommand
from poli.sublime.misc import end_strip_region
from poli.sublime.misc import insert
from poli.sublime.view_assoc import make_view_assoc


__all__ = [
    'PoliReplOpen', 'PoliReplSend', 'PoliReplClear', 'PoliReplPrev', 'PoliReplNext',
    'PoliReplSetCurrentModule'
]


class ReplTextCommand(KindSpecificTextCommand, TextCommand):
    POLI_KIND = REPL_KIND


class ReplInterruptibleTextCommand(KindSpecificTextCommand, InterruptibleTextCommand):
    POLI_KIND = REPL_KIND


class PoliReplOpen(sublime_plugin.WindowCommand):
    def run(self):
        view = make_repl_view(self.window)
        self.window.focus_view(view)


class PoliReplSend(ReplTextCommand):
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
        try:
            text = comm.eval(poli_cur_module[self.view], code)
            success = True
        except ReplEvalError as e:
            text = e.stack
            success = False

        if success:
            self.view.insert(edit, self.view.size(), '\n< ')
        else:
            self.view.insert(edit, self.view.size(), '\n! ')

        self.view.insert(edit, self.view.size(), text)
        self.view.insert(edit, self.view.size(), '\n')

        insert_prompt_at_end(self.view, edit)

        hns_for.pop(self.view)


class PoliReplClear(ReplTextCommand):
    def run(self, edit):
        self.view.set_read_only(False)
        self.view.erase(edit, sublime.Region(0, self.view.size()))
        insert_prompt_at_end(self.view, edit)
        hns_for.pop(self.view)


class PoliReplSetCurrentModule(ReplInterruptibleTextCommand):
    def run(self, edit, callback):
        module_names = comm.module_names()
        self.view.window().show_quick_panel(module_names, callback)
        (idx, ) = yield

        if idx == -1:
            return

        module_name = module_names[idx]
        poli_cur_module[self.view] = module_name
        reg = active_prompt_reg(self.view)
        with regedit.region_editing_suppressed(self.view):
            self.view.replace(edit, reg, current_prompt(self.view))


hns_for = make_view_assoc()


class HistoryNavigationState:
    def __init__(self):
        self.n_inputs_back = 0
        self.pending_input = ''


class PoliReplPrev(ReplTextCommand):
    def run(self, edit):
        if self.view in hns_for:
            hns = hns_for[self.view]
        else:
            hns = hns_for[self.view] = HistoryNavigationState()

        history = History(self.view)
        if hns.n_inputs_back == history.number - 1:
            sublime.status_message("Already at oldest input")
            return

        reg = regedit.editing_region(self.view)
        if hns.n_inputs_back == 0:
            hns.pending_input = self.view.substr(reg)
        hns.n_inputs_back += 1
        s = history.input(hns.n_inputs_back)
        self.view.erase(edit, reg)
        reg = insert(self.view, edit, reg.begin(), s)
        regedit.establish(self.view, reg)


class PoliReplNext(ReplTextCommand):
    def run(self, edit):
        if self.view in hns_for:
            hns = hns_for[self.view]
        else:
            hns = hns_for[self.view] = HistoryNavigationState()

        history = History(self.view)
        if hns.n_inputs_back == 0:
            sublime.status_message("Already at newest input")
            return

        reg = regedit.editing_region(self.view)
        hns.n_inputs_back -= 1
        if hns.n_inputs_back == 0:
            s = hns.pending_input
        else:
            s = history.input(hns.n_inputs_back)

        self.view.erase(edit, reg)
        self.view.insert(edit, reg.begin(), s)
        reg = insert(self.view, edit, reg.begin(), s)
        regedit.establish(self.view, reg)
