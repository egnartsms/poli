import sublime

from poli import config
from poli.module import operation as op
from poli.shared.command import WindowCommand
from poli.sublime.edit import call_with_edit_token
from poli.sublime.misc import openfile_spec
from poli.sublime.misc import push_to_jump_history
from poli.sublime.misc import region_to_openfile_spec
from poli.sublime.selection import jump
from poli.sublime.selection import set_selection
from poli.sublime.view_dict import on_view_load


__all__ = ['PoliGotoDefinition']


class PoliGotoDefinition(WindowCommand):
    def run(self):
        view = self.window.active_view()
        reg = op.selected_region(view)

        if op.import_section_region(view).contains(reg):
            impsec = op.parse_import_section(view)
            rec = impsec.record_under_cursor(reg)
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
            name = op.dollar_dot_name_under_cursor(view, reg)
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
