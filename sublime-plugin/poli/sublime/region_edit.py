import sublime
import sublime_plugin
import weakref

from functools import partial

from poli.sublime.misc import ViewKeyed
from poli.sublime.misc import query_context_matches
from poli.sublime.misc import read_only_set_to


__all__ = ['RegEditListener']


CLOSING_AUTOINSERT_CHARS = ')]}"\'`'


class RegEdit:
    def __init__(self, view, get_edit_region, set_edit_region, del_edit_region):
        self.view = view
        self.get_edit_region = partial(get_edit_region, view)
        self.set_edit_region = partial(set_edit_region, view)
        self.del_edit_region = partial(del_edit_region, view)
        
        self.reset()

    def reset(self):
        """Remember current state of editing region.

        This can be called to re-establish a helper after some outside changes to the
        view.        
        """
        self.pre, self.post, self.rowcol = self._get_state()

    def _get_state(self):
        reg = self.get_edit_region()
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
        reg = self.get_edit_region()
        
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
        reg = self.get_edit_region()

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
            if pre == self.pre and post == self.post and rowcol == self.rowcol:
                break
            elif pre > self.pre and post == self.post and \
                    self._is_after_insertion_at_reg_begin(pre - self.pre):
                delta = pre - self.pre
                reg = self.get_edit_region()
                self.set_edit_region(sublime.Region(reg.a - delta, reg.b))
                break
            elif post > self.post and pre == self.pre and \
                    self._is_after_insertion_at_reg_end(post - self.post):
                delta = post - self.post
                reg = self.get_edit_region()
                self.set_edit_region(sublime.Region(reg.a, reg.b + delta))
                break

            with read_only_set_to(self.view, False):
                self.view.run_command('undo')

            sublime.status_message("Cannot edit outside the editing region")

    def is_selection_within(self):
        ereg = self.get_edit_region()
        return all(ereg.contains(r) for r in self.view.sel())
    
    def set_read_only(self):
        """Compute and set the read only status for the view at this moment of time.

        If there are any cursors not within the edit region, this is True (inhibit
        modifications).  Otherwise, False (free to edit).
        """
        self.view.set_read_only(not self.is_selection_within())


regedit_for = ViewKeyed()


def start_region_editing(view, region, get_edit_region, set_edit_region, del_edit_region):
    assert not is_region_editing(view)

    set_edit_region(view, region)

    regedit_for[view] = RegEdit(view, get_edit_region, set_edit_region, del_edit_region)
    regedit_for[view].set_read_only()


def is_region_editing(view):
    return view in regedit_for


def stop_region_editing(view, read_only):
    if is_region_editing(view):
        regedit = regedit_for[view]
        del regedit_for[view]
        regedit.del_edit_region()
        view.set_read_only(read_only)


class RegEditListener(sublime_plugin.EventListener):
    """Enforce region editing to any view that has been assigned a RegEdit

    Note: how much dies this dict lookup for every view impact performance?
    """
    def on_modified(self, view):
        if is_region_editing(view):
            regedit_for[view].undo_modifications_outside_edit_region()

    def on_selection_modified(self, view):
        if is_region_editing(view):
            regedit_for[view].set_read_only()

    def on_close(self, view):
        if is_region_editing(view):
            del regedit_for[view]

    def on_query_context(self, view, key, operator, operand, match_all):
        if key == 'poli_regedit':
            return query_context_matches(is_region_editing(view), operator, operand)

        return False
