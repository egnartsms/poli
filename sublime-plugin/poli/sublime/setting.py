import sublime


def _get_settings(vs):
    if isinstance(vs, sublime.Settings):
        return vs
    else:
        return vs.settings()


class Setting:
    def __init__(self, name):
        self.name = name

    def __getitem__(self, vs):
        return _get_settings(vs).get(self.name)

    def __setitem__(self, vs, value):
        _get_settings(vs).set(self.name, value)
