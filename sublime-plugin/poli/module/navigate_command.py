import sublime
import sublime_api

from Default.symbol import navigate_to_symbol
from poli import config
from poli.comm import comm
from poli.module import operation as op
from poli.shared.command import WindowCommand
from poli.sublime.edit import call_with_edit_token
from poli.sublime.misc import openfile_spec
from poli.sublime.misc import push_to_jump_history
from poli.sublime.misc import region_to_openfile_spec, active_view_preserved
from poli.sublime.selection import jump
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import on_any_view_load
from poli.sublime.view_dict import on_view_load


__all__ = ['PoliGotoDefinition', 'PoliFindReferences']


class PoliGotoDefinition(WindowCommand):
    def run(self):
        view = self.window.active_view()
        reg = op.selected_region(view)

        if op.import_section_region(view).contains(reg):
            impsec = op.parse_import_section(view)
            rec = impsec.record_at(reg)
            if rec is None:
                sublime.status_message("No import under cursor")
                return

            other_view = self.window.open_file(op.poli_file_name(rec.module_name))

            def on_loaded():
                if rec.entry is None:
                    return

                reg = op.find_name_region(other_view, rec.entry)
                if reg is None:
                    self.window.focus_view(view)
                    sublime.status_message(
                        "Not found \"{}\" in module \"{}\"".format(name, rec.module_name)
                    )
                    return

                set_selection(other_view, to=reg.begin(), show=True)

            on_view_load(other_view, on_loaded)
        else:
            name = op.word_at(view, reg)
            if name is None:
                sublime.status_message("No name under cursor")
                return

            reg = op.find_name_region(view, name)

            if reg is not None:              
                jump(view, to=reg.begin())
            else:
                # Not found among own entries, look for imports
                impsec = op.parse_import_section(view)
                rec = impsec.record_for_imported_name(name)
                if rec is None:
                    sublime.status_message("The name \"{}\" is unknown".format(name))
                    return

                jump(view, to=view.text_point(rec.row, len(config.indent)))


class PoliFindReferences(WindowCommand):
    def run(self):
        view = self.window.active_view()
        word = op.word_at(view, op.selected_region(view))
        res = comm.find_references(op.poli_module_name(view), word)
        print("BE references:", res)
        with active_view_preserved(self.window):
            all_views = [
                self.window.open_file(op.poli_file_name(module_name))
                for module_name in res
            ]
        n_views_loaded = 0
        locations = []

        def view_loaded(view):
            nonlocal locations, n_views_loaded

            regs = view.find_all(
                '$.{}'.format(res[op.poli_module_name(view)]),
                sublime.LITERAL
            )
            locations += [make_location(view, reg) for reg in regs]
            n_views_loaded += 1
            if n_views_loaded == len(all_views):
                navigate_to_symbol(sublime.active_window().active_view(), word, locations)

        def make_location(view, reg):
            row, col = view.rowcol(reg.begin())
            return (
                view.file_name(),
                op.poli_module_name(view),
                (row + 1, col + 1)
            )

        on_any_view_load(all_views, view_loaded)
