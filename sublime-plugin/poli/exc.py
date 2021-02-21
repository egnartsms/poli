import re


class BackendError(Exception):
    def __init__(self, message, **kws):
        super().__init__(message)
        self.message = message

    @classmethod
    def make(cls, info):
        def camel_to_underscore(s):
            return re.sub(r'(?<![A-Z])[A-Z]', lambda m: '_' + m.group().lower(), s)

        return cls(**{camel_to_underscore(k): v for k, v in info.items()})


class GenericError(BackendError):
    name = 'generic'

    def __init__(self, stack, **kws):
        super().__init__(**kws)
        self.stack = stack


class ReplEvalError(BackendError):
    name = 'repl-eval'

    def __init__(self, stack, **kws):
        super().__init__(**kws)
        self.stack = stack


class CodeError(BackendError):
    name = 'code'

    def __init__(self, row, col, **kws):
        super().__init__(**kws)
        self.row = row
        self.col = col


def descendant_classes_of(cls):
    wave = list(cls.__subclasses__())
    res = set(wave)

    while wave:
        c = wave.pop()
        c_subs = set(c.__subclasses__()) - res
        res |= c_subs
        wave.extend(c_subs)

    return res


backend_errors = {sub.name: sub for sub in descendant_classes_of(BackendError)}


def make_backend_error(error, info):
    return backend_errors[error].make(info)
