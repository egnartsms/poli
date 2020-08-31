import sublime
import sublime_plugin

from poli.comm import comm
from poli.module import operation as op
from poli.module.command import ModuleInterruptibleTextCommand
from poli.module.command import ModuleTextCommand
from poli.shared.command import WindowCommand
from poli.sublime.misc import Regions, active_view_preserved
from poli.sublime.misc import insert_in
from poli.sublime.misc import read_only_set_to
from poli.sublime.edit import call_with_edit
from poli.sublime.selection import set_selection
from poli.sublime import regedit
from poli.sublime.input import chain_input_handlers, ChainableInputHandler
from poli.sublime.view_dict import on_view_load


__all__ = ['PoliMoveBy1', 'PoliMove']


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
    def run(self, src_module_entry, dest_module, dest_entry, before):
        src_module, src_entry = src_module_entry

        # Check that we're not attempting to move an entry which is under edit
        src_view = self.window.find_open_file(op.poli_file_name(src_module))
        if src_view is not None and regedit.is_active_in(src_view):
            entry = op.module_contents(src_view).entry_by_name(src_entry)
            if entry is None or entry.edit_cxt_if_under_edit():
                sulime.error_message("Source entry is under edit or not found")
                return

        # The destination entry should also not be under edit (except definition editing)
        # Other kinds of editing might fool the Sublime parser (e.g. in-progress renaming)
        dest_view = self.window.find_open_file(op.poli_file_name(dest_module))
        if dest_view is not None and regedit.is_active_in(dest_view):
            entry = op.module_contents(src_view).entry_by_name(src_entry)
            if entry is not None:
                cxt = entry.edit_cxt_if_under_edit()
                ok = cxt.target == 'defn'
            else:
                ok = False

            if not ok:
                sulime.error_message("Cound not determine destination entry location")
                return

        res = comm.move(
            src_module=src_module,
            src_entry=src_entry,
            dest_module=dest_module,
            dest_entry=dest_entry,
            before=before
        )
        print("Got this:", res)
        return

        if not res['moved']:
            offending_refs = res['offendingRefs']
            sublime.error_message("Could not move these references: {}".format(
                ','.join(offendingRefs)
            ))
            return

        with active_view_preserved(self.window):
            src_view = self.window.open_file(op.poli_file_name(src_module))
            dest_view = self.window.open_file(op.poli_file_name(dest_module))

        def process_src_view(edit):
            with regedit.region_editing_suppressed(src_view):
                mcont = op.module_contents(src_view)
                entry = mcont.entry_by_name(src_entry)
                src_view.erase(edit, entry.reg_entry_nl)

                op.save_module(src_view)

        def process_dest_view(edit):
            with regedit.region_editing_suppressed(dest_view):
                mcont = op.module_contents(dest_view)
                entry = mcont.entry_by_name(dest_entry)

                if before:
                    insert_at = entry.reg_entry_nl.begin()
                else:
                    insert_at = entry.reg_entry_nl.end()

                n = dest_view.insert(edit, insert_at, res['newCode'])
                dest_view.insert(edit, insert_at + n, '\n')

                op.save_module(dest_view)

        on_view_load(src_view, lambda: call_with_edit(src_view, process_src_view))
        on_view_load(dest_view, lambda: call_with_edit(dest_view, process_dest_view))

        # op.replace_import_section(sublime.active_window(), res)

        # # Synchronize the view(s)
        # if before:
        #     insert_at = loc.entry.reg_entry_nl.begin()
        # else:
        #     insert_at = loc.entry.reg_entry_nl.end()

        # with read_only_set_to(self.view, False), \
        #         Marker(self.view, insert_at) as insert_marker:
        #     src_entry = mcont.entry_by_name(src_entry_name)
        #     text = src_entry.contents()
        #     self.view.erase(edit, src_entry.reg_entry_nl)
        #     reg_new = insert_in(self.view, edit, insert_marker.pos, text)
        #     self.view.insert(edit, reg_new.end(), '\n')
        #     set_selection(self.view, to=reg_new, show=True)

        # op.save_module(self.view)

    def input(self, args):
        return chain_input_handlers(None, args, [
            self.SrcModuleEntry,
            self.DestModule,
            self.DestEntry,
        ])

    class SrcModuleEntry(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            res = comm.get_entries()
            self.items = [
                ("{} ({})".format(entry or '*', module), [module, entry])
                for module, entry in res
            ]

        def list_items(self):
            return self.items

    class DestModule(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            self.items = comm.get_modules()

        def list_items(self):
            return self.items

    class DestEntry(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            dest_module = args['dest_module']
            self.items = comm.get_module_entries(dest_module)

            src_module, src_entry = args['src_module_entry']
            if src_module == dest_module:
                self.items.remove(src_entry)

        def list_items(self):
            return self.items


# class PoliMoveThere(ModuleTextCommand):
#     def run(self):
#         pass


# class PoliMoveHere(ModuleTextCommand):
#     only_in_mode = 'browse'

#     def run(self, edit, before):
#         mcont = op.module_contents(self.view)
#         loc = mcont.cursor_location_or_stop(op.selected_region(self.view))
#         sublime.run_command('poli_move', {
#             'dest_module': op.poli_module_name(self.view),
#             'dest_entry': loc.entry.name(),
#             'before': before
#         })

#         dest_entry_name = loc.entry.name()
#         entry_names = comm.get_module_entries(op.poli_module_name(self.view))
#         entry_names.remove(dest_entry_name)

#         self.view.window().show_quick_panel(entry_names, callback)
#         (idx,) = yield

#         if idx == -1:
#             return

#         src_entry_name = entry_names[idx]
