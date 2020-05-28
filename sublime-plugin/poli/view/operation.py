import sublime

from poli.config import backend_root
from poli.common.misc import FreeObj


def is_view_poli(view):
    filename = view.file_name()
    return filename and filename.startswith(backend_root)


def object_location(view, reg_or_pt):
    keys = view.find_by_selector('meta.object-literal.key')
    values = view.find_by_selector('string.template')

    if len(keys) != len(values):
        sublime.error_message("Object keys and values don't match")
        raise RuntimeError

    for key, val in zip(keys, values):
        entry = key.cover(val)
        if entry.contains(reg_or_pt):
            return FreeObj(
                key=key,
                val=val,
                entry=entry,
            )
    else:
        return None


def set_edit_region(view, reg):
    view.add_regions('edit', [reg], 'region.bluish poli.edit', '',
                     sublime.DRAW_EMPTY | sublime.DRAW_NO_OUTLINE)


def get_edit_region(view):
    [reg] = view.get_regions('edit')
    return reg
