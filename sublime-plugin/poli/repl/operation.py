import sublime

from poli.shared.setting import poli_kind
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.setting import Setting


REPL_KIND = 'repl/js'

poli_cur_module = Setting('poli_cur_module')


def make_repl_view(window):
    view = window.new_file()
    view.set_name('Poli: REPL JS')
    view.set_scratch(True)
    poli_kind[view] = REPL_KIND
    poli_cur_module[view] = 'run'
    view.assign_syntax('Packages/Poli/Poli.REPL.JS.sublime-syntax')

    call_with_edit(view, lambda edit: insert_prompt_at_end(view, edit))
    
    return view


def current_prompt(view):
    return '{}> '.format(poli_cur_module[view])


def insert_prompt_at_end(view, edit):
    view.insert(edit, view.size(), current_prompt(view))
    regedit.establish(view, sublime.Region(view.size()))


def active_prompt_reg(view):
    return view.find_by_selector('punctuation.separator.poli.repl.prompt')[-1]


class History:
    """Helper class that knows where are prompt regions and result regions in a REPL"""

    def __init__(self, view):
        prompt_regs = view.find_by_selector('punctuation.separator.poli.repl.prompt')
        result_regs = view.find_by_selector('punctuation.separator.poli.repl.result')
        if len(prompt_regs) != len(result_regs) + 1:
            sublime.error_message("REPL view is broken (number of prompts and results do "
                                  "not match.")
            raise RuntimeError

        self.view = view
        self.prompt_regs = prompt_regs
        self.result_regs = result_regs

    @property
    def number(self):
        return len(self.prompt_regs)

    def input(self, n_inputs_back):
        if n_inputs_back == 0:
            reg = sublime.Region(self.prompt_regs[-1].end(), self.view.size())
        else:
            idx = len(self.prompt_regs) - 1 - n_inputs_back
            reg = sublime.Region(self.prompt_regs[idx].end(),
                                 self.result_regs[idx].begin() - 1)

        return self.view.substr(reg)
