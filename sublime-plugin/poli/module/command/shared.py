from poli.common.wrapping_method import aroundmethod
from poli.module import operation as op
from poli.shared.command import StopCommand
from poli.shared.command import TextCommand
from poli.shared.misc import Kind
from poli.shared.misc import poli_info
from poli.sublime import regedit
from poli.sublime.misc import read_only_as_transaction


class ModuleTextCommandMixin:
    only_in_mode = None

    def is_enabled(self):
        info = poli_info[self.view]
        return info is not None and info['kind'] == Kind.module

    @aroundmethod
    def run(self, edit, *args, **kwargs):
        if self.only_in_mode is None:
            pass
        elif self.only_in_mode == 'browse':
            if regedit.is_active_in(self.view):
                raise StopCommand
        elif self.only_in_mode == 'edit':
            if not regedit.is_active_in(self.view):
                raise StopCommand
        else:
            raise RuntimeError

        with read_only_as_transaction(self.view, False):
            op.ensure_trailing_nl(self.view, edit)
            op.save_module(self.view)

        yield


class ModuleTextCommand(ModuleTextCommandMixin, TextCommand):
    pass
