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


class RegionType:
    @property
    def KEY(self):
        raise NotImplementedError

    def __getitem__(self, view):
        [reg] = view.get_regions(self.KEY)
        return reg

    def __setitem__(self, view, reg):
        view.add_regions(self.KEY, [reg], '', '', sublime.HIDDEN)

    def __delitem__(self, view):
        view.erase_regions(self.KEY)


def end_strip_region(view, reg):
    pt = reg.end() - 1
    while pt >= reg.begin() and view.substr(pt).isspace():
        pt -= 1

    return sublime.Region(reg.begin(), pt + 1)
