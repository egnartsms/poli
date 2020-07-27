import re
import sublime

from poli.config import backend_root
from poli.sublime import regedit
from poli.sublime.command import StopCommand
from poli.sublime.view_dict import make_view_dict


KIND_MODULE = 'module/js'


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


def poli_module_name(view):
    return re.search(r'/([^/]+)\.poli\.js$', view.file_name()).group(1)


RE_ENTRY_NAME = r'^[a-zA-Z_][0-9a-zA-Z_]*$'
RE_DEFN = r'^(?P<name>[a-zA-Z_][0-9a-zA-Z_]*) ::= (?P<defn>.+)$'


def is_entry_name_valid(name):
    return bool(re.search(RE_ENTRY_NAME, name))


def module_contents(view):
    names = view.find_by_selector('entity.name.key.poli')
    defs = view.find_by_selector('source.js')

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    return ModuleContents(view, names, defs, module_body_start(view))


def module_body_start(view):
    [term] = view.find_by_selector('punctuation.terminator.poli.end-of-imports')
    return term.end() + 1


class ModuleContents:
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

    def cursor_location_or_stop(self, reg):
        """Return CursorLocation corresponding to reg or raise StopCommand"""
        loc = self.cursor_location(reg)
        if loc is None:
            sublime.status_message("No entry under cursor")
            raise StopCommand

        return loc

    def entry_by_name(self, name):
        for entry in self.entries:
            if entry.name() == name:
                return entry
        else:
            return None


class Entry:
    def __init__(self, mcont, reg_name, reg_def):
        self.mcont = mcont
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
        return self.mcont.view.substr(self.reg_name)

    def contents(self):
        return self.mcont.view.substr(self.reg_entry)

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


def sel_cursor_location(view):
    reg = selected_region(view)
    return module_contents(view).cursor_location_or_stop(reg)


edit_region_for = EditRegion()


class EditRegion(regedit.EditRegion):
    def __setitem__(self, view, reg):
        view.add_regions(self.KEY, [reg], 'region.bluish poli.edit', '',
                         sublime.DRAW_EMPTY | sublime.DRAW_NO_OUTLINE)


edit_cxt_for = make_view_dict()


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


def maybe_set_connected_status_in_active_view(is_connected):
    view = sublime.active_window().active_view()
    if is_view_poli(view):
        set_connected_status(view, is_connected)


def set_connected_status(view, is_connected):
    view.set_status(
        'is_connected',
        "Connected" if is_connected else "Disconnected"
    )


def enter_edit_mode(view, reg, **edit_cxt_kws):
    assert view not in edit_cxt_for

    regedit.establish(view, reg, edit_region_for)
    edit_cxt_for[view] = EditContext(**edit_cxt_kws)


def leave_edit_mode(view):
    assert view in edit_cxt_for

    cxt = edit_cxt_for.pop(view)
    regedit.discard(view, read_only=True)

    if cxt.needs_save:
        view.run_command('save')


def save_module(view):
    if view in edit_cxt_for:
        edit_cxt_for[view].needs_save = True
    else:
        view.run_command('save')
