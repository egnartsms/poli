import sublime_plugin

from poli.common.wrapping_method import WrappingMethodClass
from poli.common.wrapping_method import aroundmethod


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
    def run(self):
        try:
            yield
        except StopCommand:
            pass


class ApplicationCommand(sublime_plugin.ApplicationCommand, metaclass=WrappingMethodClass):
    @aroundmethod
    def run(self):
        try:
            yield
        except StopCommand:
            pass
