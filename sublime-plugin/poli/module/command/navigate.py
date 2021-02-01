import sublime

from Default.symbol import navigate_to_symbol
from poli.comm import comm
from poli.common.misc import index_where
from poli.common.misc import last_index_where
from poli.module import operation as op
from poli.shared.command import WindowCommand
from poli.shared.misc import single_selected_region
from poli.sublime.misc import active_view_preserved
from poli.sublime.selection import jump
from poli.sublime.view_dict import on_all_views_load

from .shared import ModuleTextCommand


__all__ = ['PoliGotoDefinition', 'PoliFindReferences', 'PoliGotoWarning', 'PoliGotoEntry']


class PoliGotoDefinition(ModuleTextCommand):
    def run(self, edit):
        reg = single_selected_region(self.view)

        if op.reg_import_section(self.view).contains(reg):
            impsec = op.parse_import_section(self.view)
            rec = impsec.record_at_or_stop(reg)
            op.goto_module_entry(self.view.window(), rec.module_name, rec.name)
        else:
            mtch = op.reference_at(self.view, reg)
            if mtch is None:
                sublime.status_message("No name under cursor")
                return

            star, name = mtch.group('star', 'name')
            op.goto_ref(self.view, star, name)


class PoliFindReferences(ModuleTextCommand):
    def run(self, edit):
        reg = single_selected_region(self.view)
        mtch = op.reference_at(self.view, reg)
        if mtch is None:
            star = None
            name = op.word_at(self.view, reg)
        else:
            star, name = mtch.group('star', 'name')

        res = comm.op('findReferences', {
            'module': op.js_module_name(self.view),
            'star': star,
            'name': name
        })
        if res is None:
            sublime.status_message(
                "Unknown reference at point: \"{}\"".format(mtch.group())
            )
            return

        with active_view_preserved(self.view.window()):
            all_views = [
                self.view.window().open_file(op.js_module_filename(module_name))
                for module_name, entry_name in res
            ]

        def make_location(view, entry_defn_name, reg):
            row, col = view.rowcol(reg.begin())
            return (
                view.file_name(),
                "{}.{}".format(op.js_module_name(view), entry_defn_name),
                (row + 1, col + 1)
            )

        def proceed():
            locations = []

            for view, (module_name, entry_name) in zip(all_views, res):
                # We also track to which definition occurences belong. We do this by
                # determining what is the key region with max index which is still fully
                # before the occurence region.
                regkeys = op.name_regions(view)
                k = 0
                entry_defn_name = "(unknown)"
                regs = view.find_all(
                    r'(?<![a-z_$])\$\.{}\b'.format(entry_name),
                    sublime.IGNORECASE
                )

                for reg in regs:
                    while k < len(regkeys) and regkeys[k].end() < reg.begin():
                        k += 1
                        entry_defn_name = view.substr(regkeys[k - 1])

                    locations.append(
                        make_location(view, entry_defn_name, reg)
                    )

            navigate_to_symbol(sublime.active_window().active_view(), name, locations)

        on_all_views_load(all_views, proceed)


class PoliGotoWarning(ModuleTextCommand):
    def run(self, edit, forward):
        reg = single_selected_region(self.view)
        warnings = op.get_warnings(self.view)
        if forward:
            idx = index_where(warnings, lambda w: w.begin() > reg.end())
        else:
            idx = last_index_where(warnings, lambda w: w.end() < reg.begin())

        if idx is None:
            sublime.status_message("No warning found")
        else:
            jump(self.view, warnings[idx].begin())


class PoliGotoEntry(WindowCommand):
    def run(self):
        data = comm.op('getEntries', {})
        
        def proceed(idx):
            if idx == -1:
                return

            module, entry = data[idx]
            op.goto_module_entry(self.window, module, entry)

        self.window.show_quick_panel(
            [entry for module, entry in data],
            proceed
        )
