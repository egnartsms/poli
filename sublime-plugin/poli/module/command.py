from poli.common.wrapping_method import aroundmethod
from poli.module.operation import KIND_MODULE
from poli.shared.setting import poli_kind
from poli.sublime import regedit
from poli.shared.command import InterruptibleTextCommand
from poli.shared.command import StopCommand
from poli.shared.command import TextCommand


class ModuleCommandMixin:
    only_in_mode = None

    def is_enabled(self):
        return poli_kind[self.view] == KIND_MODULE

    @aroundmethod
    def run(self, *args, **kwargs):
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

        yield


class ModuleTextCommand(ModuleCommandMixin, TextCommand):
    pass


class ModuleInterruptibleTextCommand(ModuleCommandMixin, InterruptibleTextCommand):
    pass
