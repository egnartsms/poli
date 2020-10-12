import re
import sublime
import sublime_plugin
import sys

from poli.comm import comm
from poli.module import operation as op
from poli.shared.setting import poli_kind


__all__ = ['PoliViewListener']


class PoliViewListener(sublime_plugin.ViewEventListener):
    @classmethod
    def is_applicable(cls, settings):        
        # return False
        # Lord, forgive me for doing this..
        view = sys._getframe(1).f_locals.get('view')
        return view is not None and op.is_view_poli(view)

    def on_load(self):
        if not op.is_js_module_view_initialized(self.view):
            op.init_js_module_view(self.view)
        op.highlight_unknown_names(self.view)

    def on_activated(self):
        op.set_connected_status(self.view, comm.is_connected)

    def on_query_completions(self, prefix, locations):
        if len(locations) != 1:
            return None

        [pt] = locations
        linereg = self.view.line(pt)
        str_prec = self.view.substr(sublime.Region(linereg.begin(), pt))
        mtch = re.search(
            r'^.*?\$(?:\.(?P<star>[a-z0-9_]+))?\.(?P<prefix>[a-z0-9_]+)$',
            str_prec,
            re.I
        )
        if mtch is None:
            return None

        entries = comm.get_completions(
            op.js_module_name(self.view),
            mtch.group('star'),
            mtch.group('prefix')
        )
        return (
            [(x, x) for x in entries],
            sublime.INHIBIT_WORD_COMPLETIONS | sublime.INHIBIT_EXPLICIT_COMPLETIONS
        )
