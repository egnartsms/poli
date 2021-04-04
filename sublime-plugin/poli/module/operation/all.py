import functools
import os.path
import re
import sublime

from .body import module_body
from .body import reg_entry_name
from .edit_mode import highlight_unknown_names
from .edit_mode import save_module
from .import_section import parse_import_section
from .structure import reg_import_section, name_region, def_regions
from operator import itemgetter
from poli.config import backend_root
from poli.shared.command import StopCommand
from poli.shared.misc import Kind
from poli.shared.misc import LANG_SUBLIME_SYNTAX
from poli.shared.misc import poli_info
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.misc import Regions
from poli.sublime.misc import active_view_preserved
from poli.sublime.misc import all_views
from poli.sublime.misc import match_at, AdjustableRegions
from poli.sublime.selection import jump
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import ViewDict
from poli.sublime.view_dict import on_all_views_load
from poli.sublime.view_dict import on_view_load


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


def view_lang(view):
    if view.file_name().endswith('.js'):
        return 'js'
    if view.file_name().endswith('.xs'):
        return 'xs'

    raise RuntimeError


def view_module_name(view):
    return re.search(r'/([^/]+)\.(js|xs)$', view.file_name()).group(1)


def module_filename(module_name, lang=None):
    """Get module absolute file name by the module name

    If lang is provided, it is used to determine file extension. If not, then we try each
    lang in turn and see whether the respective file exists on disk.    
    """
    if lang is not None:
        return os.path.join(backend_root, "{}.{}".format(module_name, lang))

    for lang in LANG_SUBLIME_SYNTAX:
        filename = os.path.join(backend_root, "{}.{}".format(module_name, lang))
        if os.path.exists(filename):
            return filename

    raise RuntimeError


def open_module(window, module_name):
    view = window.open_file(module_filename(module_name))
    setup_module_view(view)
    return view


def setup_module_view(view):
    if poli_info[view] is not None:
        return

    lang = view_lang(view)
    view.assign_syntax(LANG_SUBLIME_SYNTAX[lang])
    view.set_scratch(True)
    view.set_read_only(True)
    # This is needed because otherwise Sublime tries to fix ws in non-edit-region
    # parts of the view which leads to undoing.
    view.settings().set('trim_automatic_white_space', False)
    poli_info[view] = {
        'kind': Kind.module,
        'lang': lang
    }

    if lang == 'js':
        highlight_unknown_names(view)


def teardown_module_view(view):
    if poli_info[view] is None:
        return

    view.set_scratch(False)
    view.set_read_only(False)
    view.settings().erase('trim_automatic_white_space')
    poli_info[view] = None


def all_poli_views():
    for view in all_views():
        if is_view_poli(view):
            yield view


XS_WORD_CHAR = r'[a-zA-Z_\-0-9~!@$%^&*+=?/<>.:|]'

RE_FULL_ENTRY = {
    # the DOTALL is assumed to be on
    'js': r'^(?P<name>\w[\d\w]*) ::= (?P<defn>.+)$',
    'xs': r'^(?P<name>{XS_WORD_CHAR}+) ::=(?P<defn>.+)$'.format(**globals())
}

TEMPLATE_FULL_ENTRY = {
    'js': '{name} ::= {defn}',
    'xs': '{name} ::={defn}'
}

RE_ENTRY_NAME = {
    'js': r'^(?:\w[\d\w]*)$',
    'xs': r'^(?![-+]?\.?\d)(?:{XS_WORD_CHAR}+)$'.format(**globals())
}


def is_entry_name_valid(name):
    # TODO: refactor this func
    return bool(re.search(RE_ENTRY_NAME['js'], name))


def maybe_set_connected_status_in_active_view(is_connected):
    view = sublime.active_window().active_view()
    if is_view_poli(view):
        set_connected_status(view, is_connected)


def set_connected_status(view, is_connected):
    view.set_status('is_connected', "Connected" if is_connected else "Disconnected")


def replace_import_section_in_modules(window, data):
    """data = {module_name: section_text}"""
    with active_view_preserved(window):
        views = [open_module(window, module_name) for module_name in data]

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
                        view_module_name(view)
                    )
                )
            regs.append(entry.reg_def)
            codes.append(code_by_entry[entry.name()])

    if len(regs) != len(entries_data):
        raise RuntimeError("Could not modify module \"{}\": out of sync".format(
            view_module_name(view)
        ))

    with regedit.region_editing_suppressed(view),\
            Regions(view, regs) as retained:
        for i, code in enumerate(codes):
            view.replace(edit, retained.regs[i], code)


def modify_module(view, actions, edit):
    if action[0]['type'] == 'refresh-import-section':
        replace_import_section(view, edit, action[0]['contents'])
        del action[0]

    adj_names = AdjustableRegions(view, 'poli-names', name_regions(view))
    adj_defs = AdjustableRegions(view, 'poli-defs', def_regions(view))

    def apply_edit(action, i):
        if 'name' in action:
            adj_names[i] = replace_in(view, edit, adj_names[i], action['name'])
        if 'def' in action:
            adj_defs[i] = replace_in(view, edit, adj_defs[i], action['def'])

    for action in actions:
        if action['type'] == 'edit':



    if module_data['importSection'] is not None:
        replace_import_section(view, edit, module_data['importSection'])
    modify_module_entries(view, edit, module_data['modifiedEntries'])


def apply_modifications(modifications):
    window = sublime.active_window()

    with active_view_preserved(window):
        views = [open_module(window, module_name) for [module_name] in modifications]

    def proceed():
        for view, actions in zip(views, map(modifications, itemgetter(1))):
            print("actions: ", actions)
            call_with_edit(view, functools.partial(modify_module, view, actions))

        # save_module(view)
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
    view = open_module(window, module)

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
