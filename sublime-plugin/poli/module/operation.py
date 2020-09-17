import functools
import os.path
import re
import sublime
import sublime_api

from poli.config import backend_root
from poli.module.body import find_name_region
from poli.module.body import known_entries
from poli.module.body import module_body
from poli.module.body import module_body_start
from poli.module.import_section import parse_import_section
from poli.shared.command import StopCommand
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.misc import Regions
from poli.sublime.misc import active_view_preserved
from poli.sublime.misc import match_at
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import ViewDict
from poli.sublime.view_dict import make_view_dict
from poli.sublime.view_dict import on_all_views_load
from poli.sublime.view_dict import on_view_load


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


def replace_import_section_in_modules(window, data):
    """data = {module_name: section_text}"""
    with active_view_preserved(window):
        views = [
            window.open_file(poli_file_name(module_name))
            for module_name in data
        ]

    view_data = ViewDict(zip(views, data.values()))

    def process_1(view, edit):
        replace_import_section(view, edit, view_data[view])
        save_module(view)

    def proceed():
        for view in views:
            call_with_edit(view, functools.partial(process_1, view))
        
        sublime.status_message("{} modules' imports updated".format(len(views)))

    on_all_views_load(views, proceed)


def replace_import_section(view, edit, new_import_section):
    with regedit.region_editing_suppressed(view):
        view.replace(
            edit,
            sublime.Region(0, module_body_start(view)),
            new_import_section
        )


def modify_module_entries(view, edit, entries_data):
    if not entries_data:
        return

    mcont = module_body(view)
    code_by_entry = {entry: code for entry, code in entries_data}
    regs, codes = [], []

    if regedit.is_active_in(view):
        ereg = regedit.editing_region(view)
    else:
        ereg = None

    for entry in mcont.entries:
        if entry.name() in code_by_entry:
            if ereg and ereg.intersects(entry.reg_def):
                raise RuntimeError(
                    "Could not modify module \"{}\": entry under edit".format(
                        poli_module_name(view)
                    )
                )
            regs.append(entry.reg_def)
            codes.append(code_by_entry[entry.name()])

    if len(regs) != len(entries_data):
        raise RuntimeError("Could not modify module \"{}\": out of sync".format(
            poli_module_name(view)
        ))

    with regedit.region_editing_suppressed(view),\
            Regions(view, regs) as retained:
        for i, code in enumerate(codes):
            view.replace(edit, retained.regs[i], code)


def modify_module(view, edit, module_data):
    if module_data['importSection'] is not None:
        replace_import_section(view, edit, module_data['importSection'])
    modify_module_entries(view, edit, module_data['modifiedEntries'])


def modify_and_save_modules(window, modules_data):
    if not modules_data:
        return

    with active_view_preserved(window):
        views = [
            window.open_file(poli_file_name(d['module']))
            for d in modules_data
        ]

    def process_1(view, module_data, edit):
        modify_module(view, edit, module_data)
        save_module(view)

    def proceed():
        for view, module_data in zip(views, modules_data):
            call_with_edit(view, functools.partial(process_1, view, module_data))

        sublime.status_message("{} modules updated".format(len(views)))

    on_all_views_load(views, proceed)


def known_names(view):
    """Compute all the names accessible as $.NAME for this module"""
    return known_entries(view) | parse_import_section(view).imported_names()


def highlight_unknown_names(view):
    k_names = known_names(view)
    result = sublime_api.view_find_all_with_contents(
        view.view_id, r'\$\.([a-zA-Z0-9_]+)', 0, '\\1'
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


def word_at(view, reg):
    regword = view.word(reg)
    if regword.empty():
        return None

    return view.substr(regword)


def reference_at(view, ptreg):
    return match_at(
        view,
        ptreg,
        r'(?<![a-z_$])\$(?:\.(?P<star>[a-z0-9_]+))?\.(?P<name>[a-z0-9_]+)\b',
        re.I
    )


def goto_module_entry(window, module, entry):
    old_view = window.active_view()
    view = window.open_file(poli_file_name(module))

    def on_loaded():
        reg = find_name_region(view, entry)
        if reg is None:
            window.focus_view(old_view)
            sublime.status_message(
                "Not found \"{}\" in module \"{}\"".format(entry, module)
            )
            return

        set_selection(view, to=reg.begin(), show=True)

    if entry is not None:
        on_view_load(view, on_loaded)


def goto_donor_entry(view, imported_as, name=None):
    impsec = parse_import_section(view)
    rec = impsec.record_for_imported_name(imported_as)
    if rec is None:
        sublime.status_message("The name \"{}\" is unknown".format(imported_as))
        raise StopCommand

    goto_module_entry(view.window(), rec.module_name, name or rec.name)
