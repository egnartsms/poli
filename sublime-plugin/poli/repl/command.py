import sublime
import sublime_plugin

from poli.comm import comm
from poli.exc import ReplEvalError
from poli.repl.operation import History
from poli.repl.operation import active_prompt_reg
from poli.repl.operation import current_prompt
from poli.repl.operation import insert_prompt_at_end
from poli.repl.operation import make_repl_view
from poli.repl.operation import poli_cur_module
from poli.shared.command import InterruptibleTextCommand
from poli.shared.command import TextCommand
from poli.shared.misc import Kind
from poli.shared.misc import poli_info
from poli.sublime import regedit
from poli.sublime.misc import end_strip_region
from poli.sublime.misc import insert_in
from poli.sublime.view_dict import make_view_dict


__all__ = [
    'PoliReplOpen', 'PoliReplSend', 'PoliReplClear', 'PoliReplPrev', 'PoliReplNext',
    'PoliReplSetCurrentModule'
]


class ReplTextCommand(TextCommand):
    def is_enabled(self):
        info = poli_info[self.view]
        return info is not None and info['kind'] == Kind.repl


class ReplInterruptibleTextCommand(InterruptibleTextCommand):
    def is_enabled(self):
        info = poli_info[self.view]
        return info is not None and info['kind'] == Kind.repl


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
            text = comm.op('eval', {
                'module': poli_cur_module[self.view],
                'code': code
            })
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

        hns_for.pop(self.view, None)


class PoliReplClear(ReplTextCommand):
    def run(self, edit):
        self.view.set_read_only(False)
        self.view.erase(edit, sublime.Region(0, self.view.size()))
        insert_prompt_at_end(self.view, edit)
        hns_for.pop(self.view, None)


class PoliReplSetCurrentModule(ReplInterruptibleTextCommand):
    def run(self, edit, callback):
        module_names = comm.op('getModules', {})
        self.view.window().show_quick_panel(module_names, callback)
        (idx, ) = yield

        if idx == -1:
            return

        module_name = module_names[idx]
        poli_cur_module[self.view] = module_name
        reg = active_prompt_reg(self.view)
        with regedit.region_editing_suppressed(self.view):
            self.view.replace(edit, reg, current_prompt(self.view))


hns_for = make_view_dict()


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
        reg = insert_in(self.view, edit, reg.begin(), s)
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
        reg = insert_in(self.view, edit, reg.begin(), s)
        regedit.establish(self.view, reg)
