import contextlib
import sublime
import sublime_plugin

from poli.sublime.misc import RegionType
from poli.sublime.misc import query_context_matches
from poli.sublime.misc import read_only_set_to
from poli.sublime.view_dict import make_view_dict


__all__ = ['RegEditListener']


CLOSING_AUTOINSERT_CHARS = ')]}"\'`'

_log = False

class RegEdit:
    """Region edit context.

    :param edit_region: an object that's used like this:
       reg = edit_region[view]
       edit_region[view] = reg
       del edit_region[view]
    """
    def __init__(self, view, edit_region):
        self.view = view
        self.edit_region = edit_region
        self.pre, self.post, self.rowcol = self._get_state()

    def _get_state(self):
        """Get current state of editing region"""

        reg = self.edit_region[self.view]
        return reg.a, self.view.size() - reg.b, self.view.rowcol(reg.a)

    def _is_after_insertion_at_reg_begin(self, delta):
        """Does the current selection look like smth was inserted at region beginning?

        This is the case when the selection is a single empty cursor with the following
        placement:

            JUST INSERTEDpre-existing edit region contents
                         ^

            ()pre-existing edit region contents
             ^
        
            In this case, "(" and ")" designate any kind of paired characters where the
            matching closing char may be inserted automatically.  Such as "", '', [], (),
            {}.
        """
        sel = self.view.sel()
        if len(sel) != 1:
            return False

        [sel] = sel
        if not sel.empty():
            return False

        pt = sel.a
        reg = self.edit_region[self.view]
        
        if pt == reg.a:
            return True

        if delta == 2 and pt == reg.a - 1 and\
                self.view.substr(pt) in CLOSING_AUTOINSERT_CHARS:
            return True

        return False

    def _is_after_insertion_at_reg_end(self, delta):
        """Does the current selection look like smth was inserted at region end?

        This is the case when the selection is a single empty cursor with the following
        placement:

            pre-existing edit region contentsJUST INSERTED
                                                          ^

            pre-existing edit region contents()
                                              ^

            In this case, "(" and ")" designate any kind of paired characters where the
            matching closing char may be inserted automatically.  Such as "", '', [], (),
            {}.
        """
        sel = self.view.sel()
        if len(sel) != 1:
            return False

        [sel] = sel
        if not sel.empty():
            return False

        pt = sel.a
        reg = self.edit_region[self.view]

        if pt == reg.b + delta:
            return True

        if delta == 2 and pt == reg.b + 1 and\
                self.view.substr(pt) in CLOSING_AUTOINSERT_CHARS:
            return True

        return False

    def undo_modifications_outside_edit_region(self):
        """Undo modifications to portions of the buffer outside the edit region.

        We only detect such modifications when the sizes of the corresponding pre and post
        regions change.  This cannot detect e.g. line swaps outside the edit region but
        is still very useful.

        Also, we detect insertion of text right before the edit region and right after it,
        and extend the edit region to include what was just inserted.
        """
        while True:
            pre, post, rowcol = self._get_state()

            if _log:
                print("pre/post/rowcol:", pre, post, rowcol)
                print("remembered: ", self.pre, self.post, self.rowcol)
                print("sel:", list(self.view.sel()))

            if pre == self.pre and post == self.post and rowcol == self.rowcol:
                break
            elif pre > self.pre and post == self.post and \
                    self._is_after_insertion_at_reg_begin(pre - self.pre):
                delta = pre - self.pre
                reg = self.edit_region[self.view]
                self.edit_region[self.view] = sublime.Region(reg.a - delta, reg.b)
                break
            elif post > self.post and pre == self.pre and \
                    self._is_after_insertion_at_reg_end(post - self.post):
                delta = post - self.post
                reg = self.edit_region[self.view]
                self.edit_region[self.view] = sublime.Region(reg.a, reg.b + delta)
                break

            with read_only_set_to(self.view, False):
                if _log:
                    print("Undoing")
                self.view.run_command('undo')

            sublime.status_message("Cannot edit outside the editing region")

    def is_selection_within(self):
        ereg = self.edit_region[self.view]
        return all(ereg.contains(r) for r in self.view.sel())
    
    def set_read_only(self):
        """Compute and set the read only status for the view at this moment of time.

        If there are any cursors not within the edit region, this is True (inhibit
        modifications).  Otherwise, False (free to edit).
        """
        self.view.set_read_only(not self.is_selection_within())


regedit_for = make_view_dict()

    
class EditRegion(RegionType):
    KEY = 'edit'


def is_active_in(view):
    return view in regedit_for


def establish(view, region, edit_region=EditRegion()):
    edit_region[view] = region
    regedit_for[view] = RegEdit(view, edit_region)
    regedit_for[view].set_read_only()


def discard(view, read_only):
    assert is_active_in(view)

    del regedit_for[view].edit_region[view]
    del regedit_for[view]
    view.set_read_only(read_only)


def editing_region(view):
    return regedit_for[view].edit_region[view]


@contextlib.contextmanager
def region_editing_suppressed(view):
    """Temporarily suppress region editing in the view.

    The editing region is not touched (i.e. modifications to view can change it). If
    region editing was not active in the view, then set the view as non-read-only for the
    extent of the context manager, and restore its previous read-onlyness state.
    """
    if view not in regedit_for:
        with read_only_set_to(view, False):
            yield
            return

    edit_region = regedit_for[view].edit_region
    del regedit_for[view]
    view.set_read_only(False)

    try:
        yield
    finally:
        regedit_for[view] = RegEdit(view, edit_region)
        regedit_for[view].set_read_only()


class RegEditListener(sublime_plugin.EventListener):
    """Enforce region editing to any view that has been assigned a RegEdit

    Note: how much does this impact performance?  Dict lookup happens for every view.
    """
    n = 0

    def cb(self, view):
        print(regedit_for[view]._get_state())
        self.n += 1
        if self.n == 5:
            self.n = 0
        else:
            sublime.set_timeout(lambda: self.cb(view), 10)

    def on_modified(self, view):
        if is_active_in(view):
            # sublime.set_timeout(lambda: self.cb(view), 10)
            regedit_for[view].undo_modifications_outside_edit_region()

    def on_selection_modified(self, view):
        if is_active_in(view):
            regedit_for[view].set_read_only()

    def on_query_context(self, view, key, operator, operand, match_all):
        if key == 'poli_regedit':
            return query_context_matches(is_active_in(view), operator, operand)

        return False
