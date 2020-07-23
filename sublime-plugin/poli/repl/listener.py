import sublime
import sublime_plugin

from poli.comm import comm
from poli.repl.operation import History
from poli.repl.operation import REPL_KIND
from poli.repl.operation import poli_cur_module
from poli.shared.setting import poli_kind
from poli.sublime import regedit


__all__ = ['ReplListener']


class ReplListener(sublime_plugin.ViewEventListener):
    @classmethod
    def is_applicable(cls, settings):
        return poli_kind[settings] == REPL_KIND

    def on_activated(self):
        if not regedit.is_active_in(self.view):
            history = History(self.view)
            regedit.establish(
                self.view,
                sublime.Region(history.prompt_regs[-1].end(), self.view.size())
            )

    def on_query_completions(self, prefix, locations):
        if len(locations) != 1:
            return None

        [pt] = locations
        dollar_dot = self.view.substr(
            sublime.Region(pt - len(prefix) - 2, pt - len(prefix))
        )
        if dollar_dot != "$.":
            return None

        entries = comm.get_entries(poli_cur_module[self.view])
        return (
            [(x, x) for x in entries if x.startswith(prefix)],
            sublime.INHIBIT_WORD_COMPLETIONS
        )
