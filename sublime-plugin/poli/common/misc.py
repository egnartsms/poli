from contextlib import contextmanager
from functools import wraps


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


def last_such(iterable, pred):
    found_item = None

    for item in iterable:
        if pred(item):
            found_item = item
        else:
            break

    return found_item


class FreeObj:
    def __init__(self, **attrs):
        self.__dict__.update(attrs)


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


def method_for(*klasses):
    def install_in(fn, klass):
        name = fn.__name__
        assert not hasattr(klass, name),\
            "Class {} already has member \"{}\"".format(klass, name)
        setattr(klass, name, fn)
        
    def wrapper(fn):
        for klass in klasses:
            install_in(fn, klass)

        return None  # don't put real fn in whatever ns this decorator is being used in

    return wrapper
