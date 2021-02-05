from poli.command import *
from poli.module import *
from poli.repl import *
from poli.sublime import *

import sublime
import sublime_plugin

from poli import config
from poli.comm import comm
from poli.module import operation as op
from poli.shared.misc import poli_info
from poli.sublime.misc import query_context_matches


def plugin_loaded():
    if config.enabled:
        for view in op.all_poli_views():
            op.setup_module_view(view)
    comm.on_status_changed = op.maybe_set_connected_status_in_active_view
    comm.reconnect()
    print("Loaded Poli")


def plugin_unloaded():
    for view in op.all_poli_views():
        op.teardown_module_view(view)
    comm.disconnect()
    print("Unloaded Poli")


class PoliReconnect(sublime_plugin.ApplicationCommand):
    def run(self):
        try:
            comm.reconnect()
        except:
            sublime.status_message("Failed to connect to Poli server")
            raise
        else:
            sublime.status_message("Successfully connected to Poli server!")


class PoliViewContext(sublime_plugin.EventListener):
    def on_query_context(self, view, key, operator, operand, match_all):
        if key == 'poli_kind':
            info = poli_info[view]

            if info is None:
                return False

            parts = operand.split('/')
            if len(parts) == 2:
                kind, lang = parts
                test = kind == info['kind'] and lang == info['lang']
            elif len(parts) == 1:
                (kind, ) = parts
                test = kind == info['kind']
            else:
                return False

            return query_context_matches(operator, test)

        return False
