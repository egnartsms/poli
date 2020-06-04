import sublime

from poli.sublime import regedit
from poli.sublime.selection import set_selection


def make_repl_view(window):
    view = window.new_file()
    view.set_name('Poli: Native REPL')
    view.set_scratch(True)
    view.assign_syntax('Packages/Poli/Poli.REPL.Native.sublime-syntax')

    insert_prompt(view)
    regedit.establish(view, sublime.Region(view.size()))

    return view


def insert_prompt(view):
    set_selection(view, to=view.size())
    view.run_command('insert', {'characters': 'main> '})
