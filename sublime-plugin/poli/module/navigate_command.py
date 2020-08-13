import sublime

from poli import config
from poli.module import operation as op
from poli.shared.command import WindowCommand
from poli.sublime.misc import openfile_spec
from poli.sublime.misc import push_to_jump_history
from poli.sublime.misc import region_to_openfile_spec


__all__ = ['PoliGotoDefinition']


class PoliGotoDefinition(WindowCommand):
    def run(self):
        view = self.window.active_view()
        reg = op.selected_region(view)
        if op.import_section_region(view).contains(reg):
            return
        else:
            name = op.dollar_dot_name_under_cursor(view, reg)
            if name is None:
                sublime.status_message("No name under cursor")
                return

            reg = op.find_name_region(view, name)

            if reg is not None:
                push_to_jump_history(view)
                self.window.open_file(
                    region_to_openfile_spec(view, reg),
                    sublime.ENCODED_POSITION
                )
            else:
                # Not found among own entries, look for imports
                impsec = op.parse_import_section(view)
                rec = impsec.record_for_imported_name(name)
                if rec is None:
                    sublime.status_message("The name \"{}\" is unknown".format(name))
                    return
                push_to_jump_history(view)
                self.window.open_file(
                    openfile_spec(view, rec.row, len(config.indent)),
                    sublime.ENCODED_POSITION
                )
