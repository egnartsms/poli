import sublime_plugin


__all__ = ['ViewAssocListener']


class ViewAssoc:
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

    def pop(self, view, default=None):
        return self._dict.pop(view.id(), default)


view_assocs = []


def make_view_assoc():
    view_assoc = ViewAssoc()
    view_assocs.append(view_assoc)
    return view_assoc


class ViewAssocListener(sublime_plugin.EventListener):
    def on_close(self, view):
        for view_assoc in view_assocs:
            view_assoc.pop(view)
