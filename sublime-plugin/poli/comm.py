import json
import time
import websocket

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

    def op(self, op, args):
        start = time.perf_counter()
        try:
            self.ws.send(json.dumps({
                'op': op,
                'args': args
            }))

            res = json.loads(self.ws.recv())
            assert res['type'] == 'response'
        except Exception as exc:
            self.ws.shutdown()
            self._fire_status_changed()
            raise

        elapsed = time.perf_counter() - start
        print("{} took: {} ms".format(op, round(elapsed * 1000)))

        if res['modifyCode']:
            self.on_modify_code(res['modifyCode'])

        if res['success']:
            return res['result']
        else:
            raise make_api_error(res['error'], res['message'], res['info'])


comm = Communicator()
