from poli.sublime import *
from poli.view import *

import sublime
import sublime_plugin

from poli.comm import comm
from poli.view.operation import maybe_set_connected_status_in_active_view


def plugin_loaded():
    comm.on_status_changed = maybe_set_connected_status_in_active_view
    comm.reconnect()
    print("Loaded Poli")


def plugin_unloaded():
    comm.disconnect()
    print("Unloaded Poli")


class PoliReconnect(sublime_plugin.ApplicationCommand):
    def run(self):
        comm.reconnect()
