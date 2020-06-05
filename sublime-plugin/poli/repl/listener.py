import sublime
import sublime_plugin

from poli.repl.operation import History
from poli.sublime import regedit


__all__ = ['ReplEventListener']


class ReplEventListener(sublime_plugin.ViewEventListener):
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
