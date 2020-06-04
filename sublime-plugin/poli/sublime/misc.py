import contextlib
import sublime

from poli.common.misc import first_or_none


def view_by_settings(settings):
    return first_or_none(
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
