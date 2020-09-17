import sublime

from poli.shared.command import StopCommand


def single_selected_region(view):
    """Return a single selection region, or raise StopCommand in other cases.
    
    :raises StopCommand: if multiple or 0 regions selected.
    """
    if len(view.sel()) != 1:
        sublime.status_message("No entry under cursor (multiple cursors)")
        raise StopCommand

    [reg] = view.sel()
    return reg
