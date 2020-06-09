import functools


class aroundmethod:
    def __init__(self, meth):
        self.meth = meth


class WrappingMethodClass(type):
    def __init__(cls, name, bases, members):
        arounds = {}
        for base in cls.__mro__[1:]:
            for k, v in base.__dict__.items():
                if isinstance(v, aroundmethod):
                    arounds.setdefault(k, []).append(v.meth)

        for k, v in cls.__dict__.items():
            if k not in arounds or isinstance(v, aroundmethod):
                continue

            assert callable(v),\
                "Class member {}.{} is supposed to be callable but is not".format(cls, k)

            setattr(cls, k, wrap_all_around(arounds[k], v))


def wrap_around(around, nested):
    @functools.wraps(nested)
    def wrapped(*args, **kwargs):
        g = around(*args, **kwargs)
        res = None
        g_next = g.send

        while True:
            try:
                down = g_next(res)
            except StopIteration as stop:
                return stop.value


            try:
                if down is None:
                    res = nested(*args, **kwargs)
                else:
                    res = nested(*down.args, **down.kwargs)

                g_next = g.send
            except Exception as e:
                res = e
                g_next = g.throw

    return wrapped


def wrap_all_around(arounds, nested):
    result = nested
    for around in arounds:
        result = wrap_around(around, result)

    return result


class call_next:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
