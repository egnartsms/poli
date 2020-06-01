def set_selection(view, to=None, to_all=None, show=False):
    assert (to is None) != (to_all is None)

    view.sel().clear()
    if to_all is not None:
        view.sel().add_all(to_all)
    else:
        view.sel().add(to)

    if show:
        view.show(view.sel(), True)
