import re
import sublime
import sublime_plugin

from poli.comm import comm
from poli.sublime import regedit
from poli.sublime.selection import set_selection
from poli.view.operation import EditContext
from poli.view.operation import edit_cxt_for
from poli.view.operation import edit_region
from poli.view.operation import entry_location_at
from poli.view.operation import reg_plus_trailing_nl


__all__ = ['PoliSelect', 'PoliEdit', 'PoliAdd', 'PoliRename', 'PoliCancel', 'PoliCommit']


class PoliSelect(sublime_plugin.TextCommand):
    def run(self, edit):
        if regedit.is_active_in(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to select (multiple cursors)")
            return

        loc = entry_location_at(self.view, self.view.sel()[0])
        if loc is None:
            sublime.status_message("Nothing to select")
            return

        set_selection(self.view, to=loc.reg_entry)


class PoliEdit(sublime_plugin.TextCommand):
    def run(self, edit):
        if regedit.is_active_in(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to edit (multiple cursors)")
            return

        [reg] = self.view.sel()
        loc = entry_location_at(self.view, reg)
        
        if loc is None or not loc.is_defn_targeted:
            sublime.status_message("Cannot determine what to edit")
            return

        regedit.establish(self.view, loc.reg_defn, edit_region)
        edit_cxt_for[self.view] = EditContext(
            name=self.view.substr(loc.reg_name),
            target='defn'
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.reg_defn)


class PoliRename(sublime_plugin.TextCommand):
    def run(self, edit):
        if regedit.is_active_in(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine what to rename (multiple cursors)")
            return

        [reg] = self.view.sel()
        loc = entry_location_at(self.view, reg)
        if loc is None or not loc.is_name_targeted:
            sublime.status_message("Cannot determine what to rename")
            return

        regedit.establish(self.view, loc.reg_name, edit_region)
        edit_cxt_for[self.view] = EditContext(
            name=self.view.substr(loc.reg_name),
            target='name'
        )

        if loc.is_fully_selected:
            set_selection(self.view, to=loc.reg_name)


class PoliAdd(sublime_plugin.TextCommand):
    def run(self, edit, before_after):
        if before_after not in ('before', 'after'):
            raise RuntimeError

        if regedit.is_active_in(self.view):
            return  # Protected by keymap context

        if len(self.view.sel()) != 1:
            sublime.status_message("Cannot determine where to add (multiple cursors)")
            return

        [reg] = self.view.sel()
        loc = entry_location_at(self.view, reg)
        if loc is None:
            sublime.status_message("Cannot determine where to add")
            return

        name = self.view.substr(loc.reg_name)
        self.view.set_read_only(False)
        if before_after == 'before':
            insert_pos = loc.reg_name.begin()
        else:
            insert_pos = loc.reg_defn.end() + 1
        stub = "name ::= definition\n"
        self.view.insert(edit, insert_pos, stub)
        # not counting trailing \n
        reg_stub = sublime.Region(insert_pos, insert_pos + len(stub) - 1)
        set_selection(self.view, to=reg_stub)

        regedit.establish(self.view, reg_stub, edit_region)
        
        edit_cxt_for[self.view] = EditContext(
            name=name,
            target='entry',
            before_after=before_after
        )


class PoliCancel(sublime_plugin.TextCommand):
    def run(self, edit):
        if not regedit.is_active_in(self.view):
            return  # Protected by keymap context

        cxt = edit_cxt_for[self.view]
        if cxt.target == 'defn':
            defn = comm.get_defn(cxt.name)
            self.view.replace(edit, edit_region[self.view], defn)
        elif cxt.target == 'name':
            self.view.replace(edit, edit_region[self.view], cxt.name)
        else:
            assert cxt.target == 'entry'
            reg = reg_plus_trailing_nl(edit_region[self.view])
            self.view.set_read_only(False)
            self.view.erase(edit, reg)

        del edit_cxt_for[self.view]
        regedit.discard(self.view, read_only=True)


class PoliCommit(sublime_plugin.TextCommand):
    def run(self, edit):
        if not regedit.is_active_in(self.view):
            return  # Protected by keymap context

        cxt = edit_cxt_for[self.view]
        reg = edit_region[self.view]

        if cxt.target == 'defn':
            if reg.empty():
                sublime.status_message("Empty definition not allowed")
                return
            defn = self.view.substr(reg)
            comm.edit(cxt.name, defn)
        elif cxt.target == 'name':
            new_name = self.view.substr(reg)
            if not re.search('^[a-zA-Z_$][0-9a-zA-Z_$]*$', new_name):
                sublime.status_message("Not a valid name")
                return
            comm.rename(cxt.name, new_name)
        else:
            assert cxt.target == 'entry'
            
            print(cxt.name, cxt.before_after)

            mtch = re.search('^([a-zA-Z_$][0-9a-zA-Z_$]*) ::= (.+)$',
                             self.view.substr(reg),
                             re.DOTALL)
            if mtch is None:
                sublime.status_message("Invalid entry definition")
                return

            if cxt.before_after == 'before':
                comm.add(name=mtch.group(1), defn=mtch.group(2), before=cxt.name)
            else:
                comm.add(name=mtch.group(1), defn=mtch.group(2), after=cxt.name)

        del edit_cxt_for[self.view]
        regedit.discard(self.view, read_only=True)

        self.view.run_command('save')
