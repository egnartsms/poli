import sublime
import sublime_plugin
import inspect

from poli.common.wrapping_method import WrappingMethodClass
from poli.common.wrapping_method import aroundmethod
from poli.sublime.edit import call_with_edit_token


class StopCommand(Exception):
    pass


class TextCommand(sublime_plugin.TextCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(*args, **kwargs):
        try:
            yield
        except StopCommand:
            pass


class WindowCommand(sublime_plugin.WindowCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(self, **kwargs):
        try:
            yield
        except StopCommand:
            pass


class ApplicationCommand(sublime_plugin.ApplicationCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(self, **kwargs):
        try:
            yield
        except StopCommand:
            pass


class InterruptibleTextCommand(sublime_plugin.TextCommand):
    def run_(self, edit_token, args):
        def callback(*args):
            if inspect.getgeneratorstate(gen) != 'GEN_SUSPENDED':
                raise RuntimeError("Generator not in suspended state")

            def resume(edit_token):
                edit.edit_token = edit_token
                try:
                    gen.send(args)
                except (StopIteration, StopCommand):
                    pass
                finally:
                    edit.edit_token = 0

            call_with_edit_token(self.view, resume)

        edit = sublime.Edit(edit_token)
        gen = self.run(edit, callback, **args)

        try:
            gen.send(None)
        except (StopIteration, StopCommand):
            pass
