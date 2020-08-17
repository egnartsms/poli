import contextlib
import re
import sublime
import sublime_plugin

from Default.history_list import get_jump_history_for_view
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


@contextlib.contextmanager
def read_only_as_transaction(view, new_status):
    old_status = view.is_read_only()
    view.set_read_only(new_status)
    try:
        yield
    except:
        view.set_read_only(old_status)
        raise


@contextlib.contextmanager
def active_view_preserved(window):
    view = window.active_view()
    yield
    window.focus_view(view)


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
    """Region with all trailing spaces left out"""
    pt = reg.end() - 1
    while pt >= reg.begin() and view.substr(pt).isspace():
        pt -= 1

    return sublime.Region(reg.begin(), pt + 1)


def insert_in(view, edit, pos, s):
    n = view.insert(edit, pos, s)
    return sublime.Region(pos, pos + n)


def replace_in(view, edit, reg, s):
    view.replace(edit, reg, s)
    return sublime.Region(reg.begin(), reg.begin() + len(s))


class Marker:
    """Marker is a position in a view that relocates with inserts/erases.

    It's implemented with Sublime view.add_regions/view.erase_regions
    """
    NAME_TEMPLATE = '_marker_{}'
    MAX_KEY = 0

    pool = set()

    @classmethod
    def _alloc_key(cls):
        if cls.pool:
            return cls.pool.pop()
        else:
            key = cls.MAX_KEY
            cls.MAX_KEY += 1
            return key

    @classmethod
    def _release_key(cls, k):
        cls.pool.add(k)

    def __init__(self, view, pos):
        self.view = view
        self.key = self._alloc_key()
        self.region_name = self.NAME_TEMPLATE.format(self.key)

        self.view.add_regions(self.region_name, [sublime.Region(pos)], '', '',
                              sublime.HIDDEN)

    def release(self):
        assert self.key is not None

        self.view.erase_regions(self.region_name)
        self._release_key(self.key)

        self.key = None
        self.region_name = None
   
    @property
    def pos(self):
        [pos] = self.view.get_regions(self.region_name)
        return pos.a

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.release()
        return False


def region_to_openfile_spec(view, reg):
    row, col = view.rowcol(reg.begin())
    return openfile_spec(view, row, col)


def openfile_spec(what, row, col):
    if isinstance(what, sublime.View):
        fname = what.file_name()
    else:
        fname = what

    return "{}:{}:{}".format(fname, row + 1, col + 1)


def push_to_jump_history(view):
    get_jump_history_for_view(view).push_selection(view)
