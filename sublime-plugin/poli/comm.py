import json
import poli.config as config
import websocket

from poli.exc import make_backend_error


class Communicator:
    """An entity that knows how to talk to NodeJS server

    NOTE: on_status_changed can fire when actual status is not actually changed.
    Be prepared.
    """
    def __init__(self):
        self.ws = websocket.WebSocket()
        self.ws.timeout = config.ws_timeout
        self.on_status_changed = None
        self.on_save_message = None

    def _fire_status_changed(self):
        if self.on_status_changed is not None:
            self.on_status_changed(self.is_connected)

    @property
    def is_connected(self):
        return self.ws.connected

    def reconnect(self):
        self.disconnect()
        self.ws.connect('ws://localhost:{port}/'.format(port=config.port))
        self._fire_status_changed()

    def disconnect(self):
        self.ws.close()
        self._fire_status_changed()

    def op(self, op, args):
        try:
            self.ws.send(json.dumps({
                'op': op,
                'args': args
            }))
            while True:
                res = json.loads(self.ws.recv())
                if res['type'] == 'save':
                    self.on_save_message(res['modifications'])
                elif res['type'] == 'resp':
                    break
                else:
                    raise RuntimeError(
                        "Internal error: unrecognized WS message type: '{}'".format(
                            res['type']
                        )
                    )
        except Exception as exc:
            self.ws.shutdown()
            self._fire_status_changed()
            raise

        if res['success']:
            return res['result']
        else:
            raise make_backend_error(res['error'], res['info'])

comm = Communicator()
