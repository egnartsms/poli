import re


class BackendError(Exception):
    def __init__(self, **attrs):
        self.__dict__.update(attrs)

    @classmethod
    def make(cls, info):
        def camel_to_underscore(s):
            return re.sub(r'(?<![A-Z])[A-Z]', lambda m: '_' + m.group().lower(), s)

        return cls(**{camel_to_underscore(k): v for k, v in info.items()})


class GenericError(BackendError):
    name = 'generic'


backend_errors = {sub.name: sub for sub in BackendError.__subclasses__()}


def make_backend_error(error, info):
    return backend_errors[error].make(info)
