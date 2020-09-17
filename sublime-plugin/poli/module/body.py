import sublime

from poli.shared.command import StopCommand
from poli.sublime import regedit
from poli.shared.misc import single_selected_region


def module_body(view):
    names = name_regions(view)
    defs = def_regions(view)

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    return Body(view, names, defs, module_body_start(view))


def name_regions(view):
    return view.find_by_selector('entity.name.key.poli')


def def_regions(view):
    return view.find_by_selector('source.js')


def module_body_start(view):
    [term] = view.find_by_selector('punctuation.terminator.poli.end-of-imports')
    return term.end() + 1


class Body:
    def __init__(self, view, reg_names, reg_defs_nl, body_start):
        self.view = view
        self.body_start = body_start
        self.entries = [
            Entry(self, reg_name=reg_name, reg_def=reg_no_trailing_nl(reg_def_nl))
            for reg_name, reg_def_nl in zip(reg_names, reg_defs_nl)
        ]

    def cursor_location(self, reg):
        """Return either CursorLocation instance or None

        :param reg: either Region or position
        """
        if not isinstance(reg, sublime.Region):
            reg = sublime.Region(reg)

        if reg.end() < self.body_start:
            return None

        for entry in self.entries:
            if entry.reg_entry.contains(reg):
                return CursorLocation(
                    entry=entry,
                    is_inside_name=entry.reg_name.contains(reg),
                    is_inside_def=entry.reg_def.contains(reg),
                    is_fully_selected=(entry.reg_entry == reg)
                )

        # Special case: past the last entry is considered the last entry        
        if self.entries and reg.begin() == reg.end() == self.view.size():
            return CursorLocation(
                entry=self.entries[-1],
                is_inside_name=False,
                is_inside_def=False,
                is_fully_selected=False
            )
        
        return None

    def cursor_location_or_stop(self, reg, require_fully_selected=False):
        """Return CursorLocation corresponding to reg or raise StopCommand"""
        loc = self.cursor_location(reg)
        if loc is None:
            sublime.status_message("No entry under cursor")
            raise StopCommand
        if require_fully_selected and not loc.is_fully_selected:
            sublime.status_message("No entry is selected (select with 's' first)")
            raise StopCommand

        return loc

    def entry_by_name(self, name):
        for entry in self.entries:
            if entry.name() == name:
                return entry
        else:
            return None


class Entry:
    def __init__(self, body, reg_name, reg_def):
        self.body = body
        self.reg_name = reg_name
        self.reg_def = reg_def

    @property
    def reg_def_nl(self):
        return reg_plus_trailing_nl(self.reg_def)

    @property
    def reg_entry(self):
        return self.reg_name.cover(self.reg_def)

    @property
    def reg_entry_nl(self):
        return self.reg_name.cover(self.reg_def_nl)

    def name(self):
        return self.body.view.substr(self.reg_name)

    def contents(self):
        return self.body.view.substr(self.reg_entry)

    def is_under_edit(self):
        if not regedit.is_active_in(self.body.view):
            return False

        return regedit.editing_region(self.body.view).intersects(self.reg_entry)

    @property
    def myindex(self):
        return self.body.entries.index(self)


class CursorLocation:
    def __init__(
            self, entry, is_inside_name, is_inside_def, is_fully_selected
    ):
        self.entry = entry
        self.is_inside_name = is_inside_name
        self.is_inside_def = is_inside_def
        self.is_fully_selected = is_fully_selected

    @property
    def is_name_targeted(self):
        return self.is_inside_name or self.is_fully_selected

    @property
    def is_def_targeted(self):
        return self.is_inside_def or self.is_fully_selected


def reg_no_trailing_nl(reg):
    """Exclude the trailing \n from region (don't check whether it's actually \n char)"""
    return sublime.Region(reg.begin(), reg.end() - 1)


def reg_plus_trailing_nl(reg):
    """Include 1 more char (assumingly \n) in the end of the region"""
    return sublime.Region(reg.begin(), reg.end() + 1)


def sel_cursor_location(view, require_fully_selected=False):
    reg = single_selected_region(view)
    return module_body(view).cursor_location_or_stop(
        reg, require_fully_selected=require_fully_selected
    )


def known_entries(view):
    regs = name_regions(view)
    return {view.substr(reg) for reg in regs}


def find_name_region(view, name):
    regs = name_regions(view)
    for reg in regs:
        if view.substr(reg) == name:
            return reg

    return None
