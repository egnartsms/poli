import inspect
import sublime
import sublime_plugin

from poli.common.wrapping_method import WrappingMethodClass
from poli.common.wrapping_method import aroundmethod
from poli.exc import ApiError
from poli.sublime.edit import call_with_edit_token


class StopCommand(Exception):
    pass


class TextCommand(sublime_plugin.TextCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(self, *args, **kwargs):
        try:
            yield
        except StopCommand:
            pass
        except ApiError as e:
            sublime.error_message(str(e))


class WindowCommand(sublime_plugin.WindowCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(self, **kwargs):
        try:
            yield
        except StopCommand:
            pass
        except ApiError as e:
            sublime.error_message(str(e))


class ApplicationCommand(sublime_plugin.ApplicationCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(self, **kwargs):
        try:
            yield
        except StopCommand:
            pass
        except ApiError as e:
            sublime.error_message(str(e))


class InterruptibleTextCommand(sublime_plugin.TextCommand):
    def run_(self, edit_token, args):
        def resume(edit_token, args):
            edit.edit_token = edit_token
            try:
                gen.send(args)
            except (StopIteration, StopCommand):
                pass
            except ApiError as e:
                sublime.error_message(str(e))
            finally:
                edit.edit_token = 0

        def callback(*args):
            if inspect.getgeneratorstate(gen) != 'GEN_SUSPENDED':
                raise RuntimeError("Generator not in suspended state")

            call_with_edit_token(self.view, lambda et: resume(et, args))
        
        edit = sublime.Edit(0)
        gen = self.run(edit, callback, **args)

        resume(edit_token, None)
