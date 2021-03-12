from poli.command import *
from poli.module import *
from poli.repl import *
from poli.sublime import *

import sublime
import sublime_plugin
from contextlib import contextmanager

from poli import config
from poli.comm import comm
from poli.module import operation as op
from poli.shared.misc import poli_info
from poli.sublime.misc import query_context_matches


@contextmanager
def our_view_event_listener_classes_removed():
    """Temporarily remove all our classes from sublime_plugin.view_event_listener_classes.
    
    At the time `plugin_loaded` is called, ViewEventListeners are not yet instantiated,
    and as soon as we assign to view.settings() they will get created by means of
    `sublime_plugin.check_view_event_listeners()`. And then they will get created second
    time when we return from `plugin_loaded`. So we will end up with double listener
    instances. That's why we temporarily remove our VEL classes from that global list.
    """
    num = sum(
        1
        for key, val in globals().items()
        if isinstance(val, type) and issubclass(val, sublime_plugin.ViewEventListener)
    )

    retained = sublime_plugin.view_event_listener_classes[-num:]
    del sublime_plugin.view_event_listener_classes[-num:]

    try:
        yield
    finally:
        sublime_plugin.view_event_listener_classes += retained


@our_view_event_listener_classes_removed()
def plugin_loaded():
    if config.enabled:
        for view in op.all_poli_views():
            op.setup_module_view(view)
    comm.on_status_changed = op.maybe_set_connected_status_in_active_view
    comm.on_save_message = op.apply_modifications
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
