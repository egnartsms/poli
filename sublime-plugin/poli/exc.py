import re


class ApiError(Exception):
    def __init__(self, message):
        super().__init__(message)

    @classmethod
    def make(cls, **kwds):
        def camel_to_underscore(s):
            return re.sub(r'(?<![A-Z])[A-Z]', lambda m: '_' + m.group().lower(), s)

        instance = cls(**{camel_to_underscore(k): v for k, v in kwds.items()})

        return instance


class PoliNotConnectedError(ApiError):
    name = 'not-connected'


class UncaughtException(ApiError):
    name = 'uncaught'


class GenericError(ApiError):
    name = 'generic'


class ReplEvalError(ApiError):
    name = 'repl-eval'


class CodeError(ApiError):
    name = 'code'

    def __init__(self, row, col, **rest):
        super().__init__(**rest)
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


api_errors = {sub.name: sub for sub in descendant_classes_of(ApiError)}


def make_api_error(error, message, info):
    return api_errors[error].make(message=message, **info)
