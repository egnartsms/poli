missing = object()


def first_or_none(gen):
    return next(gen, None)


class FreeObj:
    def __init__(self, **attrs):
        self.__dict__.update(attrs)
