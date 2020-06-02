import sublime
import sublime_plugin

from poli.comm import comm
from poli.sublime.misc import query_context_matches
from poli.sublime.misc import view_by_settings
from poli.view.operation import is_view_poli
from poli.view.operation import set_connected_status


__all__ = ['PoliViewListener']


class PoliViewListener(sublime_plugin.ViewEventListener):
    @classmethod
    def is_applicable(cls, settings):
        view = view_by_settings(settings)
        return view is not None and is_view_poli(view)

    def on_load(self):
        self.view.set_scratch(True)
        self.view.set_read_only(True)

    def on_query_context(self, key, operator, operand, match_all):
        if key == 'poli_view':
            return query_context_matches(True, operator, operand)

        return False

    def on_activated(self):
        set_connected_status(self.view, comm.is_connected)
