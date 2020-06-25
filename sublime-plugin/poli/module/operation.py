import sublime

from poli.config import backend_root
from poli.sublime import regedit
from poli.sublime.command import StopCommand
from poli.sublime.regedit import EditRegion as BaseEditRegion
from poli.sublime.view_assoc import make_view_assoc


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


class ModuleContents:
    def __init__(self, view, reg_names, reg_defs_nl):
        self.view = view
        self.entries = [
            Entry(self, reg_name=reg_name, reg_def_nl=reg_def_nl)
            for reg_name, reg_def_nl in zip(reg_names, reg_defs_nl)
        ]

    def cursor_location_at(self, reg):
        """Return either CursorLocation instance or None"""
        if not isinstance(reg, sublime.Region):
            reg = sublime.Region(reg)

        for entry in self.entries:
            # reg must end strictly before reg_def because the trailing \n is included into
            # reg_def, and we don't want to count that as part of reg_def
            if entry.reg_name.begin() <= reg.begin() and reg.end() < entry.reg_def_nl.end():
                return CursorLocation(
                    entry=entry,
                    is_inside_name=entry.reg_name.contains(reg),
                    is_inside_def=entry.reg_def_nl.contains(reg),
                    is_fully_selected=(entry.reg_entry == reg)
                )
        else:
            return None

    def entry_by_name(self, name):
        for entry in self.entries:
            if entry.name() == name:
                return entry
        else:
            return None


def module_contents(view):
    names = view.find_by_selector('entity.name.key.poli')
    defs = view.find_by_selector('source.js')

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    return ModuleContents(view, names, defs)


class Entry:
    def __init__(self, mcont, reg_name, reg_def_nl):
        self.mcont = mcont
        self.reg_name = reg_name
        self.reg_def_nl = reg_def_nl

    @property
    def reg_def(self):
        return reg_no_trailing_nl(self.reg_def_nl)

    @property
    def reg_entry_nl(self):
        return self.reg_name.cover(self.reg_def_nl)

    @property
    def reg_entry(self):
        return self.reg_name.cover(reg_no_trailing_nl(self.reg_def_nl))

    def name(self):
        return self.mcont.view.substr(self.reg_name)

    def contents_nl(self):
        return self.mcont.view.substr(self.reg_entry_nl)

    @property
    def myindex(self):
        return self.mcont.entries.index(self)


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


def selected_region(view):
    """Return a single selection region, or raise StopCommand in other cases.
    
    :raises StopCommand: if multiple or 0 regions selected.
    """
    if regedit.is_active_in(view):
        raise StopCommand  # Typically protected by keymap context but still let's check

    if len(view.sel()) != 1:
        sublime.status_message("No entry under cursor (multiple cursors)")
        raise StopCommand

    [reg] = view.sel()
    return reg    


def cursor_location_at_sel(view):
    reg = selected_region(view)
    loc = module_contents(view).cursor_location_at(reg)
    if loc is None:
        sublime.status_message("No entry under cursor")
        raise StopCommand

    return loc


class EditRegion(BaseEditRegion):
    def __setitem__(self, view, reg):
        view.add_regions(self.KEY, [reg], 'region.bluish poli.edit', '',
                         sublime.DRAW_EMPTY | sublime.DRAW_NO_OUTLINE)


edit_region_for = EditRegion()


edit_cxt_for = make_view_assoc()


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


def maybe_set_connected_status_in_active_view(is_connected):
    view = sublime.active_window().active_view()
    if is_view_poli(view):
        set_connected_status(view, is_connected)


def set_connected_status(view, is_connected):
    view.set_status(
        'is_connected',
        "Connected" if is_connected else "Disconnected"
    )
