import contextlib
import re
import sublime

from Default.history_list import get_jump_history_for_view


def all_views():
    for wnd in sublime.windows():
        yield from wnd.views()


def query_context_matches(operator, test):
    if operator == sublime.OP_EQUAL:
        return test
    elif operator == sublime.OP_NOT_EQUAL:
        return not test
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


def end_plus_1(reg):
    """Return a new region that extends 1 char longer than reg"""
    return sublime.Region(reg.a, reg.b + 1)


def end_minus_1(reg):
    """Return a new region that extends 1 char shorter than reg"""
    return sublime.Region(reg.a, reg.b - 1)


def insert_in(view, edit, pos, s):
    n = view.insert(edit, pos, s)
    return sublime.Region(pos, pos + n)


def replace_in(view, edit, reg, s):
    view.replace(edit, reg, s)
    return sublime.Region(reg.begin(), reg.begin() + len(s))


def add_hidden_regions(view, name, regs):
    view.add_regions(name, regs, '', '', sublime.HIDDEN)


class Regions:
    """Temporarily save region(s) that adjust with text insertions/removals.

    Can be used to save multiple region, a single region or a single position (marker).
    """
    NAME_TEMPLATE = '_reg_{}'
    NEXT_KEY = 0

    @classmethod
    def _alloc_key(cls):
        key = cls.NEXT_KEY
        cls.NEXT_KEY += 1
        return key

    def __init__(self, view, what):
        self.view = view
        self.key = self._alloc_key()
        self.region_name = self.NAME_TEMPLATE.format(self.key)

        if isinstance(what, int):
            regs = [sublime.Region(what)]
        elif isinstance(what, sublime.Region):
            regs = [what]
        else:
            regs = what

        self.view.add_regions(self.region_name, regs, '', '', sublime.HIDDEN)

    def release(self):
        assert self.key is not None

        self.view.erase_regions(self.region_name)

        self.region_name = None
        self.key = None
        self.view = None
   
    @property
    def pos(self):
        return self.reg.a

    @property
    def reg(self):
        [reg] = self.regs
        return reg

    @property
    def regs(self):
        return self.view.get_regions(self.region_name)
    
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


def match_at(view, ptreg, pattern, flags=0):
    if isinstance(ptreg, sublime.Region):
        begin, end = ptreg.begin(), ptreg.end()
    else:
        begin = end = ptreg

    linereg = view.line(ptreg)
    begin -= linereg.begin()
    end -= linereg.begin()
    line = view.substr(linereg)

    for mtch in re.finditer(pattern, line, flags):
        mbegin, mend = mtch.span()
        if mbegin <= begin <= end <= mend:
            return mtch

    return None
