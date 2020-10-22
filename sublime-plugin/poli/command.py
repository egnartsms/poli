import poli.config as config
from poli.shared.command import WindowCommand
from poli.module import operation as op
from poli.sublime import regedit


__all__ = ['PoliEnableCommand']


class PoliEnableCommand(WindowCommand):
    def run(self, enable):
        if config.enabled != enable:
            if enable:
                switch_poli_on(self.window)
            else:
                switch_poli_off(self.window)

            config.enabled = enable


def switch_poli_off(window):
    for view in window.views():
        if op.is_view_poli(view):
            if regedit.is_active_in(view):
                op.terminate_edit_mode(view)
            op.teardown_js_module_view(view)


def switch_poli_on(window):
    for view in window.views():
        if op.is_view_poli(view):
            op.setup_js_module_view(view)
