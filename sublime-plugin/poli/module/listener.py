import sublime
import sublime_plugin

from poli.comm import comm
from poli.module.operation import KIND_MODULE
from poli.module.operation import is_view_poli
from poli.module.operation import poli_module_name
from poli.module.operation import set_connected_status
from poli.shared.setting import poli_kind
from poli.sublime.misc import view_by_settings


__all__ = ['PoliViewListener']


class PoliViewListener(sublime_plugin.ViewEventListener):
    @classmethod
    def is_applicable(cls, settings):
        # return False
        view = view_by_settings(settings)
        return view is not None and is_view_poli(view)

    def on_load(self):
        self.view.set_scratch(True)
        self.view.set_read_only(True)
        poli_kind[self.view] = KIND_MODULE

    def on_activated(self):
        set_connected_status(self.view, comm.is_connected)

    def on_query_completions(self, prefix, locations):
        if len(locations) != 1:
            return None

        [pt] = locations
        dollar_dot = self.view.substr(
            sublime.Region(pt - len(prefix) - 2, pt - len(prefix))
        )
        if dollar_dot != "$.":
            return None

        entries = comm.get_entries(poli_module_name(self.view))
        return (
            [(x, x) for x in entries if x.startswith(prefix)],
            sublime.INHIBIT_WORD_COMPLETIONS
        )
