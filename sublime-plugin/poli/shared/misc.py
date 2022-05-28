import sublime

from poli.shared.command import StopCommand
from poli.sublime.setting import Setting


poli_info = Setting('poli_info')


class Kind:
    module = 'module'
    repl = 'repl'


LANG_SUBLIME_SYNTAX = {
    'js': 'Packages/Poli/Poli.sublime-syntax',
    'xs': 'Packages/Poli/XS.sublime-syntax',
}

REPL_JS_SYNTAX_FILE = 'Packages/Poli/REPL.JS.sublime-syntax'


def single_selected_region(view):
    """Return a single selection region, or raise StopCommand in other cases.
    
    :raises StopCommand: if multiple or 0 regions selected.
    """
    if len(view.sel()) != 1:
        sublime.status_message("No entry under cursor (multiple cursors)")
        raise StopCommand

    [reg] = view.sel()
    return reg
