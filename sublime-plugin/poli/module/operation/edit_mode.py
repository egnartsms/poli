import sublime
import sublime_api

from .body import known_entries
from .import_section import parse_import_section

from poli.sublime import regedit
from poli.sublime.view_dict import make_view_dict


class EditRegion(regedit.EditRegion):
    def __setitem__(self, view, reg):
        view.add_regions(self.KEY, [reg], 'region.bluish poli.edit', '',
                         sublime.DRAW_EMPTY | sublime.DRAW_NO_OUTLINE)


edit_region_for = EditRegion()


class EditContext:
    """What is being edited in a Poli view

    :attr name: 
        if target == 'name', the old name;
        if target == 'defn', the name of the definition being edited;
        if target == 'entry', the name before or after which we want to add
    :attr target: one of 'name', 'defn', 'entry'
    :attr is_before: whether addition is performed before
    """

    def __init__(self, name, target, is_before=None):
        self.name = name
        self.target = target
        self.is_before = is_before
        self.needs_save = False


edit_cxt_for = make_view_dict()


def enter_edit_mode(view, reg, **edit_cxt_kws):
    assert not regedit.is_active_in(view)

    regedit.establish(view, reg, edit_region_for)
    edit_cxt_for[view] = EditContext(**edit_cxt_kws)


def exit_edit_mode(view):
    assert regedit.is_active_in(view)

    cxt = edit_cxt_for.pop(view)
    regedit.discard(view, read_only=True)

    if cxt.needs_save:
        view.run_command('save')

    highlight_unknown_names(view)


def terminate_edit_mode(view):
    """Exit from edit mode in the most direct and blunt way

    This must only be used before full module refresh or similar operations.
    """
    assert regedit.is_active_in(view)

    cxt = edit_cxt_for.pop(view)
    regedit.discard(view, read_only=True)


def save_module(view):
    if view in edit_cxt_for:
        edit_cxt_for[view].needs_save = True
    else:
        view.run_command('save')
        highlight_unknown_names(view)


def known_names(view):
    """Compute all the names accessible as $.NAME for this module"""
    return known_entries(view) | parse_import_section(view).imported_names()


def highlight_unknown_names(view):
    k_names = known_names(view)
    result = sublime_api.view_find_all_with_contents(
        view.view_id, r'(?<![a-z_$])\$\.([a-z0-9_]+)', sublime.IGNORECASE, '\\1'
    )
    warning_regs = [reg for reg, name in result if name not in k_names]
    add_warnings(view, warning_regs)


def add_warnings(view, regs):
    view.add_regions(
        'warnings', regs, 'invalid', '',
        sublime.DRAW_NO_FILL | sublime.DRAW_NO_OUTLINE | sublime.DRAW_STIPPLED_UNDERLINE
    )


def get_warnings(view):
    return view.get_regions('warnings')
