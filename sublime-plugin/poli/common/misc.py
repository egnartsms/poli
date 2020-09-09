def first_or_none(gen):
    return next(gen, None)


def index_where(iterable, pred=lambda x: x):
    for i, x in enumerate(iterable):
        if pred(x):
            return i

    return None


def last_index_where(iterable, pred=lambda x: x):
    idx = None
    for i, x in enumerate(iterable):
        if pred(x):
            idx = i
        else:
            return idx


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


def none_if(none_value, value):
    return None if value == none_value else value


class exc_recorded:
    def __init__(self):
        self.exc = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_value is not None:
            self.exc = exc_value

        return True

    def __bool__(self):
        return self.exc is not None
