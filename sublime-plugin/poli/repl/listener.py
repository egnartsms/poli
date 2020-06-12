import sublime
import sublime_plugin

from poli.comm import comm
from poli.repl.operation import History
from poli.sublime import regedit


__all__ = ['ReplListener']


class ReplListener(sublime_plugin.ViewEventListener):
    @classmethod
    def is_applicable(cls, settings):
        return settings.get('poli_kind') == 'repl/js'

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

        entry_names = comm.get_entry_names()
        return (
            [(x, x) for x in entry_names if x.startswith(prefix)],
            sublime.INHIBIT_WORD_COMPLETIONS
        )
