import contextlib
import sublime
import functools
import traceback
from collections import deque


def run(gen):
    def resolve(value):
        print("Async coroutine {} finished with: {}".format(gen, value))

    def reject(exc):
        print("Uncaught exception in async coroutine {}:".format(gen))
        traceback.print_exc(type(exc), exc, None)

    coroutine(gen)(resolve, reject)


def coroutine(gen):
    def awaitable(resolve, reject):
        def proceed(tocall, value):
            try:
                awt = tocall(value)
            except StopIteration as e:
                resolve(e.value)
            except Exception as e:
                reject(e)
            else:
                awt(send, throw)

        send = functools.partial(proceed, gen.send)
        throw = functools.partial(proceed, gen.throw)

        send(None)

    return awaitable


def resolved_awaitable(value):
    return lambda resolve, reject: resolve(value)


def rejected_awaitable(exc):
    return lambda resolve, reject: reject(exc)


def in_parallel(comap):  
    def awaitable(resolve, reject):
        success, failure = {}, {}
        n = len(comap)

        def subresolve(name, value):
            success[name] = value
            check()

        def subreject(name, exc):
            failure[name] = exc
            check()

        def check():
            nonlocal n

            n -= 1
            if n == 0:
                resolve((success, failure))

        for name, gen in comap.items():
            coroutine(gen)(
                functools.partial(subresolve, name), functools.partial(subreject, name)
            )

    return awaitable


class Box:
    def __init__(self):
        self.pending = None

    def __call__(self, resolve, reject):
        if hasattr(self, 'value'):
            resolve(self.value)
        elif hasattr(self, 'exc'):
            reject(self.exc)
        else:
            self.pending = (resolve, reject)

    def resolve(self, value):
        if self.pending is not None:
            self.pending[0](value)
        else:
            self.value = value

    def reject(self, exc):
        if self.pending is not None:
            self.pending[1](exc)
        else:
            self.exc = exc


def as_completed(awaitables):
    if not awaitables:
        return None

    def master_awaitable(resolve, reject):
        cur_box = Box()
        n = len(awaitables)
        
        def shift_boxes():
            nonlocal cur_box

            n -= 1
            new_box = None if n == 0 else Box()
            old_box, cur_box = cur_box, new_box

            return old_box

        def subresolve(value):
            box = shift_boxes()
            box.resolve((value, cur_box))

        def subreject(exc):
            box = shift_boxes()
            box.reject(exc)

        for awaitable in awaitables:
            awaitable(subresolve, subreject)

        cur_box(resolve, reject)

    return master_awaitable
