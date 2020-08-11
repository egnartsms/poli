import functools
import sublime_plugin


__all__ = ['ViewDictListener']


_missing = object()


class ViewDict(dict):
    def __init__(self, seq=_missing):
        if seq is _missing:
            super().__init__()
        else:
            super().__init__((view.id(), val) for view, val in seq)

    def __contains__(self, view):
        return super().__contains__(view.id())

    def __getitem__(self, view):
        return super().__getitem__(view.id())

    def __setitem__(self, view, value):
        super().__setitem__(view.id(), value)

    def __delitem__(self, view):
        super().__delitem__(view.id())

    def get(self, view, default=None):
        return super().get(view.id(), default)

    def pop(self, view, default=_missing):
        if default is _missing:
            return super().pop(view.id())
        else:
            return super().pop(view.id(), default)

    def setdefault(self, view, default):
        return super().setdefault(view.id(), default)


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
        callback()


def on_any_view_load(views, callback):
    for view in views:
        on_view_load(view, functools.partial(callback, view=view))
