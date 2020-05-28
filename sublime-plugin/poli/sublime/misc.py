import contextlib
import sublime

from poli.common.misc import missing


def view_by_settings(settings):
    return next(
        view for view in all_views()
        if view.settings().settings_id == settings.settings_id
    )


def all_views():
    for wnd in sublime.windows():
        yield from wnd.views()


def query_context_matches(value, operator, operand):
    if operator == sublime.OP_EQUAL:
        return value == operand
    elif operator == sublime.OP_NOT_EQUAL:
        return value != operand
    else:
        raise RuntimeError("Unexpected operator: {}".format(operator))


@contextlib.contextmanager
def read_only_set_to(view, new_status):
    old_status = view.is_read_only()
    view.set_read_only(new_status)
    yield
    view.set_read_only(old_status)


class ViewKeyed:
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

    def pop(self, view, default=missing):
        if default is missing:
            return self._dict.pop(view.id())
        else:
            return self._dict.pop(view.id(), default)
