import re


class BackendError(Exception):
    @classmethod
    def make(cls, info):
        def camel_to_underscore(s):
            return re.sub(r'(?<![A-Z])[A-Z]', lambda m: '_' + m.group().lower(), s)

        return cls(**{camel_to_underscore(k): v for k, v in info.items()})


class GenericError(BackendError):
    name = 'generic'

    def __init__(self, stack, message):
        super().__init__()
        self.stack = stack
        self.message = message


class ReplEvalError(GenericError):
    name = 'replEval'


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
