import sublime

from poli.config import backend_root
from poli.sublime import regedit
from poli.sublime.command import StopCommand
from poli.sublime.regedit import EditRegion as BaseEditRegion
from poli.sublime.view_assoc import make_view_assoc


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


class EntryLocation:
    def __init__(self, reg_name, reg_defn, reg_entry, is_inside_name, is_inside_defn,
                 is_fully_selected):
        self.reg_name = reg_name
        self.reg_defn = reg_defn
        self.reg_entry = reg_entry
        self.is_inside_name = is_inside_name
        self.is_inside_defn = is_inside_defn
        self.is_fully_selected = is_fully_selected

    @property
    def is_name_targeted(self):
        return self.is_inside_name or self.is_fully_selected

    @property
    def is_defn_targeted(self):
        return self.is_inside_defn or self.is_fully_selected


def entry_location_at(view, reg):
    if not isinstance(reg, sublime.Region):
        reg = sublime.Region(reg)

    names = view.find_by_selector('entity.name.key.poli')
    defs = view.find_by_selector('source.js')

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    for name, defn in zip(names, defs):
        if name.begin() <= reg.begin() and reg.end() < defn.end():
            defn = reg_no_trailing_nl(defn)
            entry = name.cover(defn)
            return EntryLocation(
                reg_name=name,
                reg_defn=defn,
                reg_entry=entry,
                is_inside_name=name.contains(reg),
                is_inside_defn=defn.contains(reg),
                is_fully_selected=(entry == reg)
            )
    else:
        return None


def reg_no_trailing_nl(reg):
    """Exclude the trailing \n from region (don't check whether it's actually \n char)"""
    return sublime.Region(reg.begin(), reg.end() - 1)


def reg_plus_trailing_nl(reg):
    """Include 1 more char (assumingly \n) in the end of the region"""
    return sublime.Region(reg.begin(), reg.end() + 1)


def entry_regions_full(view):
    names = view.find_by_selector('entity.name.key.poli')
    defs = view.find_by_selector('source.js')

    return [name.cover(defn) for name, defn in zip(names, defs)]


def entry_under_cursor(view):
    if regedit.is_active_in(view):
        raise StopCommand  # Typically protected by keymap context but still let's check

    if len(view.sel()) != 1:
        sublime.status_message("No entry under cursor (multiple cursors)")
        raise StopCommand

    [reg] = view.sel()
    loc = entry_location_at(view, reg)
    if loc is None:
        sublime.status_message("No entry under cursor")
        raise StopCommand

    return loc


class EditRegion(BaseEditRegion):
    def __setitem__(self, view, reg):
        view.add_regions(self.KEY, [reg], 'region.bluish poli.edit', '',
                         sublime.DRAW_EMPTY | sublime.DRAW_NO_OUTLINE)


edit_region = EditRegion()


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
