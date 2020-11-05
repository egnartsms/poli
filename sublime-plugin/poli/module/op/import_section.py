import sublime

from poli.common.misc import FreeObj
from poli.common.misc import first_or_none
from poli.common.misc import none_if
from poli.shared.command import StopCommand


def parse_import_section(view):
    class Module(FreeObj): pass
    class Entry(FreeObj): pass
    class Alias(FreeObj): pass

    things = (
        [Module(reg=reg) for reg in view.find_by_selector('meta.import.poli.module')] +
        [Entry(reg=reg) for reg in view.find_by_selector(
            'meta.import.poli.entry, meta.import.poli.asterisk'
         )] +
        [Alias(reg=reg) for reg in view.find_by_selector('meta.import.poli.alias')]
    )
    things.sort(key=lambda x: x.reg.begin())

    records = []
    cur_module_name = None
    i = 0

    while i < len(things):
        thing = things[i]
        i += 1

        if isinstance(thing, Module):
            cur_module_name = view.substr(thing.reg)
            continue

        assert isinstance(thing, Entry)
        
        row, col = view.rowcol(thing.reg.begin())

        if i < len(things) and isinstance(things[i], Alias):
            alias = things[i]
            i += 1
        else:
            alias = None

        records.append(
            ImportRecord(
                module_name=cur_module_name,
                row=row,
                name=none_if('*', view.substr(thing.reg)),
                alias=None if alias is None else view.substr(alias.reg)
            )
        )

    return ImportSection(view, records)


class ImportRecord:
    def __init__(self, module_name, row, name, alias):
        self.module_name = module_name
        self.row = row
        self.name = name
        self.alias = alias

    @property
    def imported_as(self):
        return self.alias or self.name

    @property
    def is_star(self):
        return self.name is None


class ImportSection:
    def __init__(self, view, records):
        self.view = view
        self.recs = records

    def imported_names(self):
        return {rec.imported_as for rec in self.recs}

    def record_for_imported_name(self, name):
        return first_or_none(rec for rec in self.recs if rec.imported_as == name)

    def record_at(self, reg):
        row, col = self.view.rowcol(reg.begin())
        row_end, col_end = self.view.rowcol(reg.end())
        if row != row_end:
            return None

        for rec in self.recs:
            if rec.row == row:
                return rec

        return None

    def record_at_or_stop(self, reg):
        rec = self.record_at(reg)
        if rec is None:
            sublime.status_message("No import record under cursor")
            raise StopCommand

        return rec
