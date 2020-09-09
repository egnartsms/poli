import sublime

from Default.symbol import navigate_to_symbol
from poli import config
from poli.comm import comm
from poli.common.misc import index_where
from poli.common.misc import last_index_where
from poli.module import operation as op
from poli.module.command import ModuleTextCommand
from poli.shared.command import TextCommand
from poli.sublime.misc import active_view_preserved
from poli.sublime.selection import jump
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import on_all_views_load
from poli.sublime.view_dict import on_view_load


__all__ = ['PoliGotoDefinition', 'PoliFindReferences', 'PoliGotoWarning']


class PoliGotoDefinition(ModuleTextCommand):
    def run(self, edit):
        reg = op.selected_region(self.view)

        if op.import_section_region(self.view).contains(reg):
            impsec = op.parse_import_section(self.view)
            rec = impsec.record_at_or_stop(reg)
            other_view = self.view.window().open_file(op.poli_file_name(rec.module_name))

            def on_loaded():
                if rec.name is None:
                    return

                reg = op.find_name_region(other_view, rec.name)
                if reg is None:
                    self.view.window().focus_view(self.view)
                    sublime.status_message(
                        "Not found \"{}\" in module \"{}\"".format(name, rec.module_name)
                    )
                    return

                set_selection(other_view, to=reg.begin(), show=True)

            on_view_load(other_view, on_loaded)
        else:
            name = op.word_at(self.view, reg)
            if name is None:
                sublime.status_message("No name under cursor")
                return

            reg = op.find_name_region(self.view, name)

            if reg is not None:              
                jump(self.view, to=reg.begin())
            else:
                # Not found among own entries, look for imports
                impsec = op.parse_import_section(self.view)
                rec = impsec.record_for_imported_name(name)
                if rec is None:
                    sublime.status_message("The name \"{}\" is unknown".format(name))
                    return

                jump(self.view, to=self.view.text_point(rec.row, len(config.indent)))


class PoliFindReferences(ModuleTextCommand):
    def run(self, edit):
        word = op.word_at(self.view, op.selected_region(self.view))
        res = comm.find_references(op.poli_module_name(self.view), word)
        with active_view_preserved(self.view.window()):
            all_views = [
                self.view.window().open_file(op.poli_file_name(module_name))
                for module_name in res
            ]

        def make_location(view, reg):
            row, col = view.rowcol(reg.begin())
            return (
                view.file_name(),
                op.poli_module_name(view),
                (row + 1, col + 1)
            )

        def proceed():
            locations = []

            for view in all_views:
                regs = view.find_all(
                    r'\$\.{}\b'.format(res[op.poli_module_name(view)])
                )
                locations.extend(make_location(view, reg) for reg in regs)

            navigate_to_symbol(sublime.active_window().active_view(), word, locations)

        on_all_views_load(all_views, proceed)


class PoliGotoWarning(TextCommand):
    def run(self, edit, forward):
        reg = op.selected_region(self.view)
        warnings = op.get_warnings(self.view)
        if forward:
            idx = index_where(warnings, lambda w: w.begin() > reg.end())
        else:
            idx = last_index_where(warnings, lambda w: w.end() < reg.begin())

        if idx is None:
            sublime.status_message("No warning found")
        else:
            jump(self.view, warnings[idx].begin())
