import json
import time
import websocket

from contextlib import contextmanager

import poli.config as config

from poli.exc import make_api_error


class Communicator:
    """An entity that knows how to talk to NodeJS server

    NOTE: on_status_changed can fire when actual status is not actually changed.
    Be prepared.
    """
    def __init__(self):
        self.ws = websocket.WebSocket()
        self.ws.timeout = config.ws_timeout
        self.on_status_changed = None
        self.on_modify_code = None
        self.pending_modify_code = False

    def _fire_status_changed(self):
        if self.on_status_changed is not None:
            self.on_status_changed(self.is_connected)

    @property
    def is_connected(self):
        return self.ws.connected

    def reconnect(self):
        self.disconnect()
        self.ws.connect('ws://localhost:{port}/sublime'.format(port=config.port))
        self._fire_status_changed()

    def disconnect(self):
        self.ws.close()
        self._fire_status_changed()

    @contextmanager
    def updating_status(self):
        try:
            yield
        finally:
            self._fire_status_changed()

    def op(self, op, args, committing_module_name=None):
        start = time.perf_counter()

        with self.updating_status():
            self.ws.send(json.dumps({
                'type': 'api-call',
                'op': op,
                'args': args
            }))
            res = json.loads(self.ws.recv())

        assert res['type'] == 'api-call-result'

        elapsed = time.perf_counter() - start
        print("{} took: {} ms".format(op, round(elapsed * 1000)))

        if res['success']:
            if res['modifyCode']:
                self.modify_code(res['modifyCode'], committing_module_name)

            return res['result']
        else:
            raise make_api_error(res['error'], res['message'], res['info'])

    def modify_code(self, modify_code_spec, committing_module_name):
        if self.pending_modify_code:
            raise RuntimeError("Overlapping code modifications")

        @self.updating_status()
        def callback(success):
            self.pending_modify_code = False
            self.ws.send(json.dumps({
                'type': 'modify-code-result',
                'success': success
            }))

        self.pending_modify_code = True
        self.on_modify_code(modify_code_spec, committing_module_name, callback)


comm = Communicator()
