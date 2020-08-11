def first_or_none(gen):
    return next(gen, None)


def index_where(iterable, pred=lambda x: x):
    for i, x in enumerate(iterable):
        if pred(x):
            return i


def range_where(iterable, pred):
    start = None

    for i, x in enumerate(iterable):
        if pred(x):
            if start is None:
                start = i
        else:
            if start is not None:
                break

    return (None, None) if start is None else (start, i)


class FreeObj:
    def __init__(self, **attrs):
        self.__dict__.update(attrs)


class SubscriptableProxy:
    def __init__(self, fn):
        self.fn = fn

    def __getitem__(self, i):
        return self.fn(i)
