import contextlib
import sublime

from .structure import def_regions
from .structure import name_regions
from .structure import reg_body

from poli.shared.command import StopCommand
from poli.shared.misc import single_selected_region
from poli.sublime.misc import add_hidden_regions
from poli.sublime.misc import end_minus_1


def module_body(view):
    names = name_regions(view)
    defs = def_regions(view)

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    return Body(view, names, defs, reg_body(view).begin())


class Body:
    KEY_NAMES = 'poli_names'
    KEY_DEFS = 'poli_defs'

    def __init__(self, view, name_regs, def_regs_nl, body_start):
        self.view = view
        self.body_start = body_start
        self.cached_name_regs = name_regs
        self.cached_def_regs_nl = def_regs_nl
        self.change_count = None

        self.entries = [Entry(self, i) for i, name_reg in enumerate(name_regs)]
    
    @property
    def name_regs(self):
        self.refresh_regions()
        return self.cached_name_regs

    @property
    def def_regs_nl(self):
        self.refresh_regions()
        return self.cached_def_regs_nl

    @contextlib.contextmanager
    def regions_tracked(self):
        add_hidden_regions(self.view, self.KEY_NAMES, self.cached_name_regs)
        add_hidden_regions(self.view, self.KEY_DEFS, self.cached_def_regs_nl)
        self.change_count = self.view.change_count()

        try:
            yield
        finally:
            self.change_count = None
            self.view.erase_regions(self.KEY_DEFS)
            self.view.erase_regions(self.KEY_NAMES)

    def refresh_regions(self):
        if self.change_count is not None and \
                self.change_count != self.view.change_count():
            self.cached_name_regs = self.view.get_regions(self.KEY_NAMES)
            self.cached_def_regs_nl = self.view.get_regions(self.KEY_DEFS)
            self.change_count = self.view.change_count()

    def cursor_location(self, reg):
        """Return either CursorLocation instance or None

        :param reg: either Region or position
        """
        if not isinstance(reg, sublime.Region):
            reg = sublime.Region(reg)

        if reg.end() < self.body_start:
            return None

        for entry in self.entries:
            if entry.reg.contains(reg):
                return CursorLocation(
                    entry=entry,
                    is_inside_name=entry.reg_name.contains(reg),
                    is_inside_def=entry.reg_def.contains(reg),
                    is_fully_selected=(entry.reg == reg)
                )

        # Special case: past the last entry is considered the last entry        
        if self.entries and reg.begin() >= self.entries[-1].reg_nl.end():
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
    def __init__(self, body, index):
        self.body = body
        self.myindex = index

    @property
    def reg_def_nl(self):
        return self.body.def_regs_nl[self.myindex]
    
    @property
    def reg_def(self):
        return end_minus_1(self.reg_def_nl)

    @property
    def is_last(self):
        return self.myindex == len(self.body.entries) - 1

    @property
    def reg_name(self):
        return self.body.name_regs[self.myindex]

    @property
    def reg(self):
        return self.reg_name.cover(self.reg_def)

    @property
    def reg_nl(self):
        return self.reg_name.cover(self.reg_def_nl)

    def name(self):
        return self.body.view.substr(self.reg_name)

    def contents(self):
        return self.body.view.substr(self.reg)

    def contents_nl(self):
        return self.body.view.substr(self.reg_nl)

    def is_exclusively_selected(self):
        if len(self.body.view.sel()) != 1:
            return False

        [reg] = self.body.view.sel()
        return reg == self.reg


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
    """Exclude the trailing \n from region if it is there"""
    return sublime.Region(reg.begin(), reg.end() - 1)


def sel_cursor_location(view, require_fully_selected=False):
    reg = single_selected_region(view)
    return module_body(view).cursor_location_or_stop(
        reg, require_fully_selected=require_fully_selected
    )


def reg_entry_name(view, name):
    regs = name_regions(view)
    for reg in regs:
        if view.substr(reg) == name:
            return reg

    return None
