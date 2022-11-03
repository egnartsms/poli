import contextlib
import os.path
import re
import sublime

from . import edit_mode as em
from .body import Body
from .body import module_body
from .body import reg_entry_name
from .edit_mode import highlight_unknown_names
from .import_section import parse_import_section
from .structure import reg_import_section

from poli.common.misc import method_for
from poli.config import backend_root
from poli.shared.command import StopCommand
from poli.shared.misc import Kind
from poli.shared.misc import LANG_SUBLIME_SYNTAX
from poli.shared.misc import poli_info
from poli.sublime.edit import call_with_edit
from poli.sublime.misc import active_view_preserved
from poli.sublime.misc import all_views
from poli.sublime.misc import end_plus_1, end_minus_1
from poli.sublime.misc import insert_in
from poli.sublime.misc import match_at
from poli.sublime.misc import read_only_set_to
from poli.sublime.selection import jump
from poli.sublime.selection import set_selection
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
    # # This is needed because otherwise Sublime tries to fix ws in non-edit-region
    # # parts of the view which leads to undoing.
    # view.settings().set('trim_automatic_white_space', False)
    poli_info[view] = {
        'kind': Kind.module,
        'lang': lang
    }

    # if lang == 'js':
    #     highlight_unknown_names(view)


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
    'js': r'^(?P<name>\w[\d\w]*) ::= (?P<def>.+)$',
    'xs': r'^(?P<name>{XS_WORD_CHAR}+) ::=(?P<def>.+)$'.format(**globals())
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


def ensure_trailing_nl(view, edit):
    if view.substr(view.size() - 1) != '\n':
        with read_only_set_to(view, False):
            view.insert(edit, view.size(), '\n')


class ModificationConflict(Exception):
    def __init__(self, module_name):
        super().__init__("Code modification conflict in module '{}'".format(module_name))
        self.module_name = module_name


def apply_code_modifications(modules_actions, committing_module_name, callback):
    assert modules_actions or committing_module_name is not None

    if modules_actions:
        modify_spec = []

        for module_name, action_list in modules_actions:
            with active_view_preserved(sublime.active_window()):
                view = open_module(sublime.active_window(), module_name)

            is_committing = module_name == committing_module_name
            if is_committing and not em.in_edit_mode(view):
                raise RuntimeError(
                    "Module '{}' is designated as committing but not in "
                    "edit mode".format(module_name)
                )

            modify_spec.append((view, action_list, is_committing))
    else:
        with active_view_preserved(sublime.active_window()):
            view = open_module(sublime.active_window(), committing_module_name)

        modify_spec = [(view, [], True)]

    on_all_views_load(
        [view for view, *rest in modify_spec],
        lambda: modify_modules(modify_spec, callback)
    )


def modify_modules(modify_spec, callback):
    try:
        do_modify_modules(modify_spec)
    except:
        sublime.status_message("Code modification failed")
        callback(False)
        raise
    else:
        sublime.status_message("{} modules updated".format(len(modify_spec)))
        callback(True)


def do_modify_modules(modify_spec):
    with contextlib.ExitStack() as stack:
        for view, action_list, is_committing in modify_spec:
            if em.in_edit_mode(view):
                cxt = modify_editing_module(view, action_list, is_committing)
            else:
                cxt = modify_browsing_module(view, action_list)

            stack.enter_context(cxt)


@contextlib.contextmanager
def modify_editing_module(view, action_list, is_committing):
    view.set_read_only(False)
    try:
        if action_list:
            call_with_edit(
                view,
                lambda edit: apply_actions(view, edit, action_list, True, is_committing)
            )
        yield
    except:
        view.run_command('undo')
        em.adjust_edit_mode(view)
        raise
    else:
        if is_committing:
            em.quit_edit_mode(view)
        else:
            em.adjust_edit_mode(view)

        em.save_module(view)


@contextlib.contextmanager
def modify_browsing_module(view, action_list):
    view.set_read_only(False)
    try:
        call_with_edit(
            view,
            lambda edit: apply_actions(view, edit, action_list, False, False)
        )
        yield
    except:
        view.run_command('undo')
        view.set_read_only(True)
        raise
    else:
        em.save_module(view)
        view.set_read_only(True)


def apply_actions(view, edit, action_list, under_edit, is_committing):
    assert not (is_committing and not under_edit)

    ensure_trailing_nl(view, edit)

    for action in action_list:
        committed = apply_action(view, edit, action, under_edit, is_committing)
        # Once committed, this module behaves as if it's not under edit any more
        if committed:
            under_edit = False
            is_committing = False


def apply_action(view, edit, action, under_edit, is_committing):
    body = module_body(view)

    if is_committing and em.edit_cxt_for[view].adding_new:
        ephemeral_index = body.remove_ephemeral_entry()
    else:
        ephemeral_index = -1

    committed = False

    if action['type'] == 'insert/replace':
        eOnto = body.entries[action['onto']]
        if under_edit and eOnto.is_def_under_edit():
            if is_committing:
                committed = True
            else:
                raise ModificationConflict(view_module_name(view))
        view.replace(edit, eOnto.reg_def, action['def'])
        if not (under_edit and eOnto.is_name_under_edit()):
            view.replace(edit, eOnto.reg_name, action['name'])
    elif action['type'] == 'insert':
        if action['at'] == ephemeral_index:
            point = em.edit_region_for[view].begin()
            view.erase(edit, end_plus_1(em.edit_region_for[view]))
            committed = True
        else:
            point = body.insertion_point(action['at'])

        view.insert(
            edit, point, '{action[name]} ::= {action[def]}\n'.format(action=action)
        )
    elif action['type'] == 'rename':
        entry = body.entries[action['at']]
        if under_edit and entry.is_name_under_edit():
            if is_committing:
                committed = True
            else:
                raise ModificationConflict(view_module_name(view))
        view.replace(edit, entry.reg_name, action['newName'])
    elif action['type'] == 'delete':
        entry = body.entries[action['at']]
        if under_edit and entry.is_under_edit():
            raise ModificationConflict(view_module_name(view))

        view.erase(edit, entry.reg_nl)
    elif action['type'] == 'move':
        eFrom = body.entries[action['from']]
        to = body.insertion_point(action['to'])

        with body.regions_tracked():
            reg = insert_in(view, edit, to, eFrom.contents_nl())
            if under_edit and eFrom.is_under_edit():
                em.move_edit_region(view, to - eFrom.reg.a)
            if eFrom.is_exclusively_selected():
                set_selection(view, to=end_minus_1(reg), show=True)
            view.erase(edit, eFrom.reg_nl)
    elif action['type'] == 'move/replace':
        if under_edit and eOnto.is_under_edit():
            raise ModificationConflict(view_module_name(view))

        eFrom = body.entries[action['from']]
        eOnto = body.entries[action['onto']]

        with body.regions_tracked():
            view.replace(edit, eOnto.reg_nl, eFrom.contents_nl())
            if under_edit and eFrom.is_under_edit():
                em.move_edit_region(view, eOnto.reg.a - eFrom.reg.a)
            view.erase(edit, eFrom.reg_nl)
    elif action['type'] == 'replace-import-section':
        view.replace(edit, reg_import_section(view), action['with'])
    else:
        raise RuntimeError

    return committed


@method_for(Body)
def insertion_point(self, index):
    if index < len(self.entries):
        return self.entries[index].reg.begin()
    elif self.entries:
        return self.entries[-1].reg_nl.end()
    else:
        return self.body_start


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
