import contextlib
import sublime

from .body import Body
from .body import Entry
from .highlight_names import highlight_unknown_names

from poli.common.misc import method_for
from poli.exc import CodeError
from poli.shared.command import StopCommand
from poli.sublime import regedit
from poli.sublime.misc import read_only_as_transaction
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import make_view_dict


class EditRegion(regedit.EditRegion):
    def __setitem__(self, view, reg):
        view.add_regions(
            self.KEY, [reg], 'poli.edit', '', sublime.DRAW_EMPTY | sublime.DRAW_NO_FILL
        )


edit_region_for = EditRegion()


def move_edit_region(view, shift):
    reg = edit_region_for[view]
    edit_region_for[view] = sublime.Region(reg.a + shift, reg.b + shift)


class EditContext:
    def __init__(self, adding_new):
        self.adding_new = adding_new
        self.saved_partial = False


edit_cxt_for = make_view_dict()


def in_edit_mode(view):
    return view in edit_cxt_for


def enter_edit_mode(view, reg, adding_new):
    assert not in_edit_mode(view)

    regedit.establish_in(view, reg, edit_region_for)
    edit_cxt_for[view] = EditContext(adding_new)


def adjust_edit_mode(view):
    """Enter edit mode after some modifications have been applied to the view"""
    regedit.establish(view, edit_region_for)


def quit_edit_mode(view):
    # TODO: rename this func to exit_*
    cxt = edit_cxt_for.pop(view)
    regedit.discard(view, read_only=True)
    if cxt.saved_partial:
        view.run_command('save')
    highlight_unknown_names(view)


@contextlib.contextmanager
def quitting_edit_mode(view):
    with read_only_as_transaction(view, False):
        yield
        quit_edit_mode(view)


def terminate_edit_mode(view):
    """Exit from edit mode in the most direct and blunt way

    This must only be used before full module refresh or similar operations.
    """
    assert regedit.is_active_in(view)

    cxt = edit_cxt_for.pop(view)
    regedit.discard(view, read_only=True)


@method_for(Body)
def remove_ephemeral_entry(self):
    """Return index of the new entry to be added.

    The view must be in edit mode, with 'adding_new=True'.

    We may or may not have included whatever the user entered as a new entry in 'body',
    depending on whether what the user entered satisfies the entry syntax. If yes, then
    exclude it because it doesn't yet exist in the Poli system so indexing would become
    wrong. In any case, return the index at which a new entry is gonna arrive.
    """
    ereg = edit_region_for[self.view]
    i = 0

    while i < len(self.entries):
        reg = self.entries[i].reg

        if reg.contains(ereg):
            del self.entries[i]
            break
        elif ereg < reg:
            break

        i += 1

    return i


@method_for(Body)
def entry_under_edit(self):
    ereg = edit_region_for[self.view]
    i = 0
    j = len(self.entries) - 1

    while i <= j:
        k = (i + j) >> 1

        if self.entries[k].reg.contains(ereg):
            return self.entries[k]

        if self.entries[k].reg < ereg:
            i = k + 1
        else:
            j = k - 1

    raise RuntimeError


@method_for(Entry)
def is_under_edit(self):
    return self.reg.contains(edit_region_for[self.body.view])


@method_for(Entry)
def is_name_under_edit(self):
    return self.reg_name == edit_region_for[self.body.view]


@method_for(Entry)
def is_def_under_edit(self):
    return self.reg_def == edit_region_for[self.body.view]


def save_module(view):
    view.run_command('save')

    if in_edit_mode(view):
        edit_cxt_for[view].saved_partial = True
    else:
        highlight_unknown_names(view)


@contextlib.contextmanager
def code_error_source_indication(view, begin_pt):
    try:
        yield
    except CodeError as e:
        row0, col0 = view.rowcol(begin_pt)
        rowe = row0 + e.row
        cole = col0 + e.col if e.row == 0 else e.col
        error_point = view.text_point(rowe, cole)
        set_selection(view, to=error_point)
        sublime.status_message(e.message)
        raise StopCommand
