from poli.sublime.edit import call_with_edit
from poli.sublime.misc import push_to_jump_history


def set_selection(view, to=None, to_all=None, show=False):
    assert (to is None) != (to_all is None)

    view.sel().clear()
    if to_all is not None:
        view.sel().add_all(to_all)
    else:
        view.sel().add(to)

    if show:
        view.show(view.sel(), True)


def jump(view, to):
    def go(*args):
        push_to_jump_history(view)
        set_selection(view, to=to, show=True)

    if not view.is_in_edit():
        call_with_edit(view, go)
    else:
        go()
