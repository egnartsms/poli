import sublime

from poli.config import backend_root
from poli.common.misc import FreeObj


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


def module_entry_at(view, reg_or_pt):
    names = view.find_by_selector('entity.name.key.poli')
    defs = view.find_by_selector('source.js')

    if len(names) != len(defs):
        sublime.error_message("Module names and definitions don't match")
        raise RuntimeError

    if isinstance(reg_or_pt, sublime.Region):
        x_a, x_b = reg_or_pt.begin(), reg_or_pt.end()
    else:
        x_a = x_b = reg_or_pt

    for name, defn in zip(names, defs):
        if name.begin() <= x_a and x_b < defn.end():
            defn = adjust_defn_region(defn)
            return FreeObj(
                name=name,
                defn=defn,
                entry=name.cover(defn)
            )
    else:
        return None


def adjust_defn_region(defn):
    """Exclude the trailing \n from defn region as it does not count"""
    return sublime.Region(defn.begin(), defn.end() - 1)


def set_edit_region(view, reg):
    view.add_regions('edit', [reg], 'region.bluish poli.edit', '',
                     sublime.DRAW_EMPTY | sublime.DRAW_NO_OUTLINE)


def get_edit_region(view):
    [reg] = view.get_regions('edit')
    return reg


def del_edit_region(view):
    view.erase_regions('edit')


def maybe_set_connected_status_in_active_view(is_connected):
    view = sublime.active_window().active_view()
    if is_view_poli(view):
        set_connected_status(view, is_connected)


def set_connected_status(view, is_connected):
    view.set_status(
        'is_connected',
        "Connected" if is_connected else "Disconnected"
    )
