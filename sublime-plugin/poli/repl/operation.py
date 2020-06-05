import sublime

from poli.sublime import regedit
from poli.sublime.selection import set_selection


def make_repl_view(window):
    view = window.new_file()
    view.set_name('Poli: REPL JS')
    view.set_scratch(True)
    view.settings().set('poli_kind', 'repl/js')
    view.assign_syntax('Packages/Poli/Poli.REPL.JS.sublime-syntax')

    insert_prompt(view)
    
    return view


def insert_prompt(view):
    set_selection(view, to=view.size())
    view.run_command('insert', {'characters': 'main> '})
    regedit.establish(view, sublime.Region(view.size()))


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