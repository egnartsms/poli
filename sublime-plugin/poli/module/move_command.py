import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.module.command import ModuleInterruptibleTextCommand
from poli.module.command import ModuleTextCommand
from poli.shared.command import WindowCommand
from poli.sublime import regedit
from poli.sublime.edit import call_with_edit
from poli.sublime.input import ChainableInputHandler
from poli.sublime.input import chain_input_handlers
from poli.sublime.input import run_command_thru_palette
from poli.sublime.misc import Regions
from poli.sublime.misc import active_view_preserved
from poli.sublime.misc import insert_in
from poli.sublime.misc import read_only_set_to
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import on_view_load


__all__ = [
    'PoliMoveBy1', 'PoliMove', 'PoliMoveThis', 'PoliMoveHere', 'PoliMoveToThisModule'
]


class PoliMoveBy1(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, direction):
        mcont = op.module_contents(self.view)
        loc = mcont.cursor_location_or_stop(
            op.selected_region(self.view), require_fully_selected=True
        )
        comm.move_by_1(op.poli_module_name(self.view), loc.entry.name(), direction)

        # OK, now synchronize the view itself
        i = loc.entry.myindex

        if direction == 'up':
            if i == 0:
                insert_at = mcont.entries[-1].reg_entry_nl.end()
            else:
                insert_at = mcont.entries[i - 1].reg_entry_nl.begin()
        else:
            if i + 1 == len(mcont.entries):
                insert_at = mcont.body_start
            else:
                insert_at = mcont.entries[i + 1].reg_entry_nl.end()

        with read_only_set_to(self.view, False), \
                Regions(self.view, insert_at) as insert_marker:
            text = loc.entry.contents()
            self.view.erase(edit, loc.entry.reg_entry_nl)
            reg_new = insert_in(self.view, edit, insert_marker.pos, text)
            self.view.insert(edit, reg_new.end(), '\n')
            set_selection(self.view, to=reg_new, show=True)

        op.save_module(self.view)


class PoliMove(WindowCommand):
    def run(self, src_module_entry, dest_module, anchor, before):
        src_module, entry = src_module_entry

        # Check that we're not attempting to move an entry which is under edit
        src_view = self.window.find_open_file(op.poli_file_name(src_module))
        if src_view is not None and regedit.is_active_in(src_view):
            entry = op.module_contents(src_view).entry_by_name(entry)
            if entry is None or entry.is_under_edit():
                sublime.error_message("Source entry is under edit or not found")
                return

        # The destination entry should also not be under edit (except definition editing)
        # Other kinds of editing might fool the Sublime parser (e.g. ongoing renaming)
        dest_view = self.window.find_open_file(op.poli_file_name(dest_module))
        if (dest_view is not None and anchor is not None and
                regedit.is_active_in(dest_view)):
            entry = op.module_contents(dest_view).entry_by_name(anchor)
            
            if (entry is None or
                    entry.is_under_edit() and
                    op.edit_cxt_for[dest_view].target != 'defn'):
                sublime.error_message("Anchor entry is under edit or not found")
                return

        res = comm.move(
            src_module=src_module,
            entry=entry,
            dest_module=dest_module,
            anchor=anchor,
            before=before
        )

        if not res['moved']:
            msg = ["Failed to move the entry because:\n"]
            
            if res['offendingRefs']:
                msg.append(
                    "the definition refers to names that could not be imported into "
                    "the destination module: {}".format(', '.join(res['offendingRefs']))
                )
            if res['blockingReferrers']:
                msg.append(
                    "these modules cannot star-import the entry from the destination "
                    "module: {}".format(', '.join(res['offendingRefs']))
                )

            sublime.error_message('\n'.join(msg))
            return

        with active_view_preserved(self.window):
            src_view = self.window.open_file(op.poli_file_name(src_module))
            dest_view = self.window.open_file(op.poli_file_name(dest_module))

        def process_src_view(edit):
            with regedit.region_editing_suppressed(src_view):
                entry = op.module_contents(src_view).entry_by_name(entry)
                src_view.erase(edit, entry.reg_entry_nl)
                op.save_module(src_view)

        def process_dest_view(edit):
            with regedit.region_editing_suppressed(dest_view):
                entry = op.module_contents(dest_view).entry_by_name(anchor)

                if before:
                    insert_at = entry.reg_entry_nl.begin()
                else:
                    insert_at = entry.reg_entry_nl.end()

                dest_view.insert(
                    edit, insert_at, '{} ::= {}\n'.format(entry, res['newCode'])
                )

                op.save_module(dest_view)

        on_view_load(src_view, lambda: call_with_edit(src_view, process_src_view))
        on_view_load(dest_view, lambda: call_with_edit(dest_view, process_dest_view))

        op.modify_modules(res['modifiedModules'])

        if res['danglingRefs']:
            sublime.message_dialog(
                "These references appear to be dangling: \n   {}".format(
                    ',\n   '.join('$.' + r for r in res['danglingRefs'])
                )
            )

    def input(self, args):
        return chain_input_handlers(None, args, [
            self.SrcModuleEntry,
            self.DestModule,
            self.Anchor,
            self.Before
        ])

    class SrcModuleEntry(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            data = comm.get_entries()
            self.items = [
                ("{} ({})".format(entry or '*', module), [module, entry])
                for module, entry in data
            ]

        def list_items(self):
            return self.items

        def placeholder(self):
            return "Entry to move"

    class DestModule(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            self.items = comm.get_modules()

        def list_items(self):
            return self.items

        def placeholder(self):
            return "Destination module"

    class Anchor(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            dest_module = args['dest_module']
            self.items = comm.get_module_entries(dest_module)

            src_module, entry = args['src_module_entry']
            if src_module == dest_module:
                self.items.remove(entry)

        def list_items(self):
            return self.items

        def placeholder(self):
            return "Anchor entry"

    class Before(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)

        def list_items(self):
            return [("Before", True), ("After", False)]


class PoliMoveThis(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = op.sel_cursor_location(self.view, require_fully_selected=True)
        run_command_thru_palette(self.view.window(), 'poli_move', {
            'src_module_entry': [op.poli_module_name(self.view), loc.entry.name()],
        })


class PoliMoveHere(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, before):
        loc = op.sel_cursor_location(self.view, require_fully_selected=True)
        run_command_thru_palette(self.view.window(), 'poli_move', {
            'dest_module': op.poli_module_name(self.view),
            'anchor': loc.entry.name(),
            'before': before
        })


class PoliMoveToThisModule(ModuleTextCommand):
    def run(self, edit):
        run_command_thru_palette(self.view.window(), 'poli_move', {
            'dest_module': op.poli_module_name(self.view)
        })
