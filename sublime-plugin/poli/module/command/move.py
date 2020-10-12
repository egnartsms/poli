import sublime
import sublime_plugin
import traceback

from functools import partial

from poli.comm import comm
from poli.common.misc import exc_recorded
from poli.module import operation as op
from poli.module.body import module_body
from poli.module.body import module_body_start
from poli.module.body import sel_cursor_location
from poli.module.shared import ModuleTextCommand
from poli.shared.command import StopCommand
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
from poli.shared.misc import single_selected_region
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import on_all_views_load


__all__ = [
    'PoliMoveBy1', 'PoliMove', 'PoliMoveThis', 'PoliMoveHere', 'PoliMoveToThisModule'
]


class PoliMoveBy1(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, direction):
        mcont = module_body(self.view)
        loc = mcont.cursor_location_or_stop(
            single_selected_region(self.view), require_fully_selected=True
        )
        comm.move_by_1(op.js_module_name(self.view), loc.entry.name(), direction)

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
    def run(self, src_module_entry, dest_module, anchor, before=None):
        src_module, entry = src_module_entry

        self._check_src_available(src_module, entry)
        self._check_anchor_available(dest_module, anchor)

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
                    "the destination module: {}".format(
                        ', '.join('$.' + r for r in res['offendingRefs'])
                    )
                )
            if res['blockingReferrers']:
                msg.append(
                    "these modules cannot star-import the entry from the destination "
                    "module: {}".format(', '.join(res['blockingReferrers']))
                )

            sublime.error_message('\n'.join(msg))
            return

        def process_source(view, edit):          
            with regedit.region_editing_suppressed(view):
                entry_obj = module_body(view).entry_by_name(entry)
                view.erase(edit, entry_obj.reg_entry_nl)
                op.save_module(view)

        def process_destination(view, edit):
            with regedit.region_editing_suppressed(view):
                if anchor is None:
                    insert_at = module_body_start(view)
                else:
                    mcont = module_body(view)
                    if anchor is False:
                        insert_at = mcont.entries[0].reg_entry_nl.begin()
                    elif anchor is True:
                        insert_at = mcont.entries[-1].reg_entry_nl.end()
                    else:
                        entry_obj = module_body(view).entry_by_name(anchor)

                        if before:
                            insert_at = entry_obj.reg_entry_nl.begin()
                        else:
                            insert_at = entry_obj.reg_entry_nl.end()

                view.insert(
                    edit, insert_at, '{} ::= {}\n'.format(entry, res['newCode'])
                )

                op.save_module(view)

        def process_other(view, module_data, edit):
            op.modify_module(view, edit, module_data)
            op.save_module(view)

        def proceed(src_view, dest_view, other_views):
            with exc_recorded() as exc_src:
                call_with_edit(src_view, partial(process_source, src_view))

            with exc_recorded() as exc_dest:
                call_with_edit(dest_view, partial(process_destination, dest_view))

            exc_others = [exc_recorded() for view in other_views]

            for exc, view, module_data in zip(
                    exc_others, other_views, res['modifiedModules']
            ):
                with exc:
                    call_with_edit(
                        view, partial(process_other, view, module_data)
                    )

            fmodules = {
                op.js_module_name(view)
                for exc, view in zip(exc_others, other_views)
                if exc
            }
            if exc_src:
                fmodules.add(op.js_module_name(src_view))
            if exc_dest:
                fmodules.add(op.js_module_name(dest_view))

            if fmodules:
                sublime.error_message(
                    "The following modules failed to update (you may consider refreshing "
                    "them from the image): {}".format(', '.join(fmodules))
                )

                if exc_src:
                    print("Source updating failed:")
                    traceback.print_exception(type(exc_src.exc), exc_src.exc, None)
                if exc_dest:
                    print("Dest updating failed:")
                    traceback.print_exception(type(exc_dest.exc), exc_dest.exc, None)
                for view, exc in zip(other_views, exc_others):
                    if not exc:
                        continue
                    print("Modified module \"{}\" updating failed:".format(
                        op.js_module_name(view)
                    ))
                    traceback.print_exception(type(exc.exc), exc.exc, None)
            elif res['danglingRefs']:
                sublime.message_dialog(
                    "These references appear to be dangling: {}".format(
                        ','.join('$.' + r for r in res['danglingRefs'])
                    )
                )
            else:
                sublime.status_message("Move succeeded!")

        with active_view_preserved(self.window):
            src_view = self.window.open_file(op.js_module_filename(src_module))
            dest_view = self.window.open_file(op.js_module_filename(dest_module))
            other_views = [
                self.window.open_file(op.js_module_filename(d['module']))
                for d in res['modifiedModules']
            ]

        on_all_views_load(
            [src_view, dest_view] + other_views,
            lambda: proceed(src_view, dest_view, other_views)
        )

    def _check_src_available(self, src_module, entry):
        """Check that we're not attempting to move an entry which is under edit"""
        src_view = self.window.find_open_file(op.js_module_filename(src_module))
        if src_view is not None and regedit.is_active_in(src_view):
            entry_obj = module_body(src_view).entry_by_name(entry)
            if entry_obj is None or entry_obj.is_under_edit():
                sublime.error_message("Source entry is under edit or not found")
                raise StopCommand

    def _check_anchor_available(self, dest_module, anchor):
        """Check that the anchor entry is not under edit (except definition editing).
        
        Other kinds of editing might fool the Sublime parser (e.g. ongoing renaming)
        """
        dest_view = self.window.find_open_file(op.js_module_filename(dest_module))
        if dest_view is not None and anchor is not None and \
                regedit.is_active_in(dest_view):
            mcont = module_body(dest_view)
            if anchor is True:
                entry_obj = mcont.entries[-1]
            elif anchor is False:
                entry_obj = mcont.entries[0]
            else:
                entry_obj = mcont.entry_by_name(anchor)
            
            if (entry_obj is None or
                    entry_obj.is_under_edit() and
                    op.edit_cxt_for[dest_view].target != 'defn'):
                sublime.error_message("Anchor entry is under edit or not found")
                raise StopCommand

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
                ("{} ({})".format(entry, module), [module, entry])
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
            self.items.remove(args['src_module_entry'][0])

        def list_items(self):
            return self.items

        def placeholder(self):
            return "Destination module"

    class Anchor(ChainableInputHandler, sublime_plugin.ListInputHandler):
        BOTTOM = '<<<Bottom>>>'
        TOP = '<<<Top>>'

        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)
            dest_module = args['dest_module']
            self.items = comm.get_module_entries(dest_module)

            src_module, entry = args['src_module_entry']
            if src_module == dest_module:
                self.items.remove(entry)

            if self.items:
                self.items[:0] = [(self.BOTTOM, True), (self.TOP, False)]

        def list_items(self):
            return self.items

        def placeholder(self):
            return "Anchor entry"

        def next_input(self, args):
            value = args['anchor']
            if value in (False, True, None):
                return None
            else:
                return super().next_input(args)

    class Before(ChainableInputHandler, sublime_plugin.ListInputHandler):
        def __init__(self, view, args, chain_tail):
            super().__init__(view, chain_tail)

        def list_items(self):
            return [("Before", True), ("After", False)]


class PoliMoveThis(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit):
        loc = sel_cursor_location(self.view, require_fully_selected=True)
        run_command_thru_palette(self.view.window(), 'poli_move', {
            'src_module_entry': [op.js_module_name(self.view), loc.entry.name()],
        })


class PoliMoveHere(ModuleTextCommand):
    only_in_mode = 'browse'

    def run(self, edit, before):
        loc = sel_cursor_location(self.view, require_fully_selected=True)
        run_command_thru_palette(self.view.window(), 'poli_move', {
            'dest_module': op.js_module_name(self.view),
            'anchor': loc.entry.name(),
            'before': before
        })


class PoliMoveToThisModule(ModuleTextCommand):
    def run(self, edit):
        run_command_thru_palette(self.view.window(), 'poli_move', {
            'dest_module': op.js_module_name(self.view)
        })
