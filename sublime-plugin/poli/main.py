import sublime
import sublime_plugin

from poli.comm import comm
from poli.view import *
from poli.sublime import *


def plugin_loaded():
    comm.reconnect()
    print("Loaded Poli")


def plugin_unloaded():
    comm.ensure_disconnected()
    print("Unloaded Poli")


class PoliReconnect(sublime_plugin.ApplicationCommand):
    def run(self):
        comm.reconnect()
        if comm.is_connected:
            sublime.status_message("Poli: connected!")
