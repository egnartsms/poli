import sublime_plugin

from poli.config import backend_root


__all__ = ['Listener']


class Listener(sublime_plugin.EventListener):
    def on_load(self, view):
        if view.file_name().startswith(backend_root):
            view.set_scratch(True)
            view.set_read_only(True)
