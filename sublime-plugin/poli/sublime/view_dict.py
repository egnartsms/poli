import collections.abc
import sublime
import sublime_plugin


__all__ = ['ViewDictListener']


class ViewDict(collections.abc.MutableMapping):
    def __init__(self, seq=None):
        if seq is None:
            self.data = {}
        else:
            self.data = dict((view.id(), val) for view, val in seq)

    def __getitem__(self, view):
        return self.data[view.id()]

    def __setitem__(self, view, value):
        self.data[view.id()] = value

    def __delitem__(self, view):
        del self.data[view.id()]

    def __len__(self):
        return len(self.data)

    def __iter__(self):
        return iter(self.data)


view_dicts = []


def make_view_dict():
    view_dict = ViewDict()
    view_dicts.append(view_dict)
    return view_dict


class ViewDictListener(sublime_plugin.EventListener):
    def on_close(self, view):
        for view_dict in view_dicts:
            view_dict.pop(view, None)

    def on_load(self, view):
        callbacks = on_view_loaded.pop(view, [])
        for cb in callbacks:
            cb()


on_view_loaded = make_view_dict()


def on_view_load(view, callback):
    if view.is_loading():
        on_view_loaded.setdefault(view, []).append(callback)
    else:
        sublime.set_timeout(callback, 0)


def on_all_views_load(views, callback):
    n = len(views)

    def load_1():
        nonlocal n

        n -= 1
        if n == 0:
            callback()

    for view in views:
        on_view_load(view, load_1)
