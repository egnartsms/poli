import sublime_plugin

from collections import defaultdict


__all__ = ['ViewDictListener']


_missing = object()


class ViewDict:
    def __init__(self):
        self._dict = {}

    def __contains__(self, view):
        return view.id() in self._dict

    def __getitem__(self, view):
        return self._dict[view.id()]

    def __setitem__(self, view, value):
        self._dict[view.id()] = value

    def __delitem__(self, view):
        del self._dict[view.id()]

    def get(self, view):
        return self._dict.get(view.id())

    def pop(self, view, default=_missing):
        if default is _missing:
            return self._dict.pop(view.id())
        else:
            return self._dict.pop(view.id(), default)


class ViewDefaultDict(ViewDict):
    def __init__(self, producer):
        self._dict = defaultdict(producer)


view_dicts = []


def make_view_dict():
    view_dict = ViewDict()
    view_dicts.append(view_dict)
    return view_dict


class ViewDictListener(sublime_plugin.EventListener):
    def on_close(self, view):
        for view_dict in view_dicts:
            view_dict.pop(view, None)
