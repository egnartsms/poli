missing = object()


def first_or_none(gen):
    return next(gen, None)


def index_where(iterable, pred=lambda x: x):
    for i, x in enumerate(iterable):
        if pred(x):
            return i


class FreeObj:
    def __init__(self, **attrs):
        self.__dict__.update(attrs)
