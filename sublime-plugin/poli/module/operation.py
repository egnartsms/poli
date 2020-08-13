import os.path
import re
import sublime
import sublime_api

from poli.common.misc import FreeObj
from poli.common.misc import none_if
from poli.config import backend_root
from poli.shared.command import StopCommand
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.misc import active_view_preserved
from poli.sublime.view_dict import ViewDict
from poli.sublime.view_dict import make_view_dict
from poli.sublime.view_dict import on_any_view_load

KIND_MODULE = 'module/js'


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


def poli_module_name(view):
    return re.search(r'/([^/]+)\.poli\.js$', view.file_name()).group(1)


def poli_file_name(module_name):
    return os.path.join(backend_root, "{}.poli.js".format(module_name))


re_entry_name = r'(?P<entry_name>[a-zA-Z_][0-9a-zA-Z_]*)'
re_is_entry_name = r'^{}$'.format(re_entry_name)


def is_entry_name_valid(name):
    return bool(re.search(re_is_entry_name, name))


def maybe_set_connected_status_in_active_view(is_connected):
    view = sublime.active_window().active_view()
    if is_view_poli(view):
        set_connected_status(view, is_connected)


def set_connected_status(view, is_connected):
    view.set_status('is_connected', "Connected" if is_connected else "Disconnected")


def module_contents(view):
    names = name_regions(view)
    defs = view.find_by_selector('source.js')

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    return ModuleContents(view, names, defs, module_body_start(view))


def name_regions(view):
    return view.find_by_selector('entity.name.key.poli')


def import_section_end(view):
    [term] = view.find_by_selector('punctuation.terminator.poli.end-of-imports')
    return term.begin()


def import_section_region(view):
    return sublime.Region(0, import_section_end(view))


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
    if len(view.sel()) != 1:
        sublime.status_message("No entry under cursor (multiple cursors)")
        raise StopCommand

    [reg] = view.sel()
    return reg


def sel_cursor_location(view, require_fully_selected=False):
    reg = selected_region(view)
    return module_contents(view).cursor_location_or_stop(
        reg, require_fully_selected=require_fully_selected
    )


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


def save_module(view):
    if view in edit_cxt_for:
        edit_cxt_for[view].needs_save = True
    else:
        view.run_command('save')

    highlight_unknown_names(view)


def highlight_unknown_names(view):
    k_names = known_names(view)
    result = sublime_api.view_find_all_with_contents(
        view.view_id, r'\$\.([a-zA-Z0-9]+)', 0, '\\1'
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


def replace_import_section(view, edit, new_import_section):
    with regedit.region_editing_suppressed(view):
        view.replace(
            edit,
            sublime.Region(0, module_body_start(view)),
            new_import_section
        )


def replace_import_section_in_modules(window, data):
    """data = {module_name: section_text}"""
    with active_view_preserved(window):
        views = [
            window.open_file(poli_file_name(module_name))
            for module_name in data
        ]

    view_data = ViewDict(zip(views, data.values()))

    def process_view(view, edit):
        replace_import_section(view, edit, view_data[view])
        save_module(view)
        del view_data[view]
        if not view_data:
            sublime.status_message("{} modules' imports updated".format(len(views)))

    on_any_view_load(
        views,
        lambda view: call_with_edit(view, lambda edit: process_view(view, edit))
    )


def parse_import_section(view):
    class Module(FreeObj): pass
    class Entry(FreeObj): pass
    class Alias(FreeObj): pass

    things = (
        [Module(reg=reg) for reg in view.find_by_selector('meta.import.poli.module')] +
        [Entry(reg=reg)
         for reg in view.find_by_selector('meta.import.poli.entry, meta.import.poli.asterisk')
        ] +
        [Alias(reg=reg) for reg in view.find_by_selector('meta.import.poli.alias')]
    )
    things.sort(key=lambda x: x.reg.begin())

    result = []
    cur_module_name = None
    i = 0

    while i < len(things):
        thing = things[i]
        i += 1

        if isinstance(thing, Module):
            cur_module_name = view.substr(thing.reg)
            continue

        assert isinstance(thing, Entry)
        
        row, col = view.rowcol(thing.reg.begin())

        if i < len(things) and isinstance(things[i], Alias):
            alias = things[i]
            i += 1
        else:
            alias = None

        result.append(
            FreeObj(
                module_name=cur_module_name,
                row=row,
                entry=none_if('*', view.substr(thing.reg)),
                alias=None if alias is None else view.substr(alias.reg)
            )
        )

    return ImportSection(view, result)


class ImportSection:
    def __init__(self, view, records):
        self.view = view
        self.recs = records

    def imported_names(self):
        return {rec.alias or rec.entry for rec in self.recs}

    def record_for_imported_name(self, name):
        for rec in self.recs:
            if (rec.alias or rec.entry) == name:
                return rec

        return None

    def record_at(self, reg):
        row, col = self.view.rowcol(reg.begin())
        row_end, col_end = self.view.rowcol(reg.end())
        if row != row_end:
            return None

        for rec in self.recs:
            if rec.row == row:
                return rec

        return None


def known_names(view):
    """Compute all the names accessible as $.NAME for this module"""
    return known_entries(view) | parse_import_section(view).imported_names()


def known_entries(view):
    regs = name_regions(view)
    return {view.substr(reg) for reg in regs}


def find_name_region(view, name):
    regs = name_regions(view)
    for reg in regs:
        if view.substr(reg) == name:
            return reg

    return None


def word_at(view, reg):
    regword = view.word(reg)
    if regword.empty():
        return None

    return view.substr(regword)
