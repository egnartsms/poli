import sublime_plugin

import poli.config as config
from poli.shared.command import WindowCommand
from poli.module.operation import is_view_poli


__all__ = ['PoliEnableCommand']


class PoliEnableCommand(WindowCommand):
    def run(self, enable):
        if config.enabled != enable:
            config.enabled = enable
            reopen_poli_views_in(self.window)


def reopen_poli_views_in(window):
    """Close and re-open Poli views in the given window"""
    print("Enabled?", config.enabled)
    active_view = window.active_view()
    for view in window.views():
        if is_view_poli(view):
            fname = view.file_name()
            view.close()
            new_view = window.open_file(fname)
            if view == active_view:
                active_view = new_view

    window.focus_view(active_view)
