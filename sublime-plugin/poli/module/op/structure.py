import sublime


def reg_end_of_imports(view):
    [reg] = view.find_by_selector('punctuation.terminator.poli.end-of-imports')
    return reg


def reg_import_section(view):
    eoi = reg_end_of_imports(view)
    return sublime.Region(0, eoi.begin())


def reg_body(view):
    eoi = reg_end_of_imports(view)
    return sublime.Region(eoi.end() + 1, view.size())


def name_regions(view):
    return view.find_by_selector('entity.name.key.poli')


def def_regions(view):
    return view.find_by_selector('meta.def.poli')
