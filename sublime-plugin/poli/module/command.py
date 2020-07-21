from poli.module.operation import KIND_MODULE
from poli.shared.command import KindSpecificTextCommand
from poli.sublime.command import InterruptibleTextCommand
from poli.sublime.command import TextCommand


class ModuleTextCommand(KindSpecificTextCommand, TextCommand):
    POLI_KIND = KIND_MODULE


class ModuleInterruptibleTextCommand(KindSpecificTextCommand, InterruptibleTextCommand):
    POLI_KIND = KIND_MODULE
