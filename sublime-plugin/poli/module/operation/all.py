import functools
import os.path
import re
import sublime

from .body import module_body
from .body import reg_entry_name
from .edit_mode import save_module
from .import_section import parse_import_section
from .structure import reg_import_section

from poli.config import backend_root
from poli.shared import const
from poli.shared.command import StopCommand
from poli.shared.setting import poli_kind
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.misc import Regions
from poli.sublime.misc import active_view_preserved
from poli.sublime.misc import all_views
from poli.sublime.misc import match_at
from poli.sublime.selection import jump
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import ViewDict
from poli.sublime.view_dict import on_all_views_load
from poli.sublime.view_dict import on_view_load


KIND_MODULE = 'module/js'


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


def js_module_name(view):
    return re.search(r'/([^/]+)\.js$', view.file_name()).group(1)


def module_filename(module_name, lang):
    return os.path.join(backend_root, "{}.{}".format(module_name, lang))


def open_js_module(window, module_name):
    view = window.open_file(module_filename(module_name, 'js'))
    setup_js_module_view(view)
    return view


def setup_js_module_view(view):
    if poli_kind[view] is None:
        view.assign_syntax(const.JS_SYNTAX_FILE)
        view.set_scratch(True)
        view.set_read_only(True)
        # This is needed because otherwise Sublime tries to fix ws in non-edit-region
        # parts of the view which leads to undoing.
        view.settings().set('trim_automatic_white_space', False)
        poli_kind[view] = KIND_MODULE


def teardown_js_module_view(view):
    if poli_kind[view] is not None:
        view.set_scratch(False)
        view.set_read_only(False)
        view.settings().erase('trim_automatic_white_space')
        poli_kind[view] = None


def all_poli_views():
    for view in all_views():
        if is_view_poli(view):
            yield view


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


def replace_import_section_in_modules(window, data):
    """data = {module_name: section_text}"""
    with active_view_preserved(window):
        views = [open_js_module(window, module_name) for module_name in data]

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
            reg_import_section(view),
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
                        js_module_name(view)
                    )
                )
            regs.append(entry.reg_def)
            codes.append(code_by_entry[entry.name()])

    if len(regs) != len(entries_data):
        raise RuntimeError("Could not modify module \"{}\": out of sync".format(
            js_module_name(view)
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
        views = [open_js_module(window, d['module']) for d in modules_data]

    def process_1(view, module_data, edit):
        modify_module(view, edit, module_data)
        save_module(view)

    def proceed():
        for view, module_data in zip(views, modules_data):
            call_with_edit(view, functools.partial(process_1, view, module_data))

        sublime.status_message("{} modules updated".format(len(views)))

    on_all_views_load(views, proceed)


def word_at(view, reg):
    regword = view.word(reg)
    if regword.empty():
        return None

    return view.substr(regword)


def reference_at(view, ptreg):
    return match_at(view, ptreg, r'(?<![\w$])\$(?:\.(?P<star>\w+))?\.(?P<name>\w+)\b')


def goto_module_entry(window, module, entry):
    old_view = window.active_view()
    view = open_js_module(window, module)

    def on_loaded():
        reg = reg_entry_name(view, entry)
        if reg is None:
            window.focus_view(old_view)
            sublime.status_message(
                "Not found \"{}\" in module \"{}\"".format(entry, module)
            )
            return

        set_selection(view, to=reg.begin(), show=True)

    if entry is not None:
        on_view_load(view, on_loaded)


def goto_ref(view, star, name):
    if star is None:
        goto_direct_ref(view, name)
    else:
        was_star = goto_star_ref(view, star, name)
        if not was_star:
            goto_direct_ref(view, star)


def goto_star_ref(view, star, name):
    impsec = parse_import_section(view)
    rec = impsec.record_for_imported_name(star)
    if rec is None or not rec.is_star:
        return False

    goto_module_entry(view.window(), rec.module_name, name)
    return True


def goto_direct_ref(view, name):
    reg = reg_entry_name(view, name)

    if reg is not None:
        jump(view, to=reg.begin())
    else:
        # Not found among own entries, look for imports
        goto_donor_entry(view, name)


def goto_donor_entry(view, imported_as):
    """Goto donor's entry which is imported into 'view' as 'imported_as'"""
    impsec = parse_import_section(view)
    rec = impsec.record_for_imported_name(imported_as)
    if rec is None:
        sublime.status_message("The name \"{}\" is unknown".format(imported_as))
        raise StopCommand

    goto_module_entry(view.window(), rec.module_name, rec.name)
