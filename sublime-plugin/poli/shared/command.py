from poli.shared.setting import poli_kind


class KindSpecificTextCommand:
    POLI_KIND = None   # to be set by descendant class

    def __init__(self, view):
        super().__init__(view)
        if poli_kind[view] is not None and poli_kind[view] != self.POLI_KIND:
            self.is_enabled = lambda: False

    def is_enabled(self):
        return poli_kind[self.view] == self.POLI_KIND
