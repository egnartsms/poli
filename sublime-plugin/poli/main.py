from poli.module import *
from poli.repl import *
from poli.sublime import *
from poli.command import *

import sublime
import sublime_plugin

from poli.comm import comm
from poli.module.operation import maybe_set_connected_status_in_active_view
from poli.shared.setting import poli_kind
from poli.sublime.misc import query_context_matches
from poli.command import reopen_poli_views_in


def plugin_loaded():
    comm.on_status_changed = maybe_set_connected_status_in_active_view
    reopen_poli_views_in(sublime.active_window())
    comm.reconnect()
    print("Loaded Poli")


def plugin_unloaded():
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
            return query_context_matches(poli_kind[view], operator, operand)

        return False
