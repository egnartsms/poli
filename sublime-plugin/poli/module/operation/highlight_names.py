import sublime
import sublime_api

from .import_section import parse_import_section
from .structure import name_regions


def known_entries(view):
    regs = name_regions(view)
    return {view.substr(reg) for reg in regs}


def known_names(view):
    """Compute all the names accessible as $.NAME for this module"""
    return known_entries(view) | parse_import_section(view).imported_names()


def highlight_unknown_names(view):
    k_names = known_names(view)
    result = sublime_api.view_find_all_with_contents(
        view.view_id, r'(?<![\w$])\$\.(\w+)', 0, '\\1'
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
