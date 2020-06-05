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

    def _send_op(self, op, args):
        try:
            self.ws.send(json.dumps({
                'op': op,
                'args': args
            }))
            res = json.loads(self.ws.recv())
        except Exception as exc:
            self.ws.shutdown()
            self._fire_status_changed()
            raise

        if res['success']:
            return res['result']
        else:
            raise make_backend_error(res['error'], res['info'])

    def get_defn(self, name):
        return self._send_op('getDefinition', {
            'name': name
        })

    def edit(self, name, new_defn):
        return self._send_op('edit', {
            'name': name,
            'newDefn': new_defn
        })

    def rename(self, old_name, new_name):
        return self._send_op('rename', {
            'oldName': old_name,
            'newName': new_name
        })

    def add(self, name, defn, after=None, before=None):
        return self._send_op('add', {
            'name': name,
            'defn': defn,
            'after': after,
            'before': before
        })

    def eval(self, code):
        return self._send_op('eval', {
            'code': code
        })

    def delete(self, name):
        return self._send_op('delete', {
            'name': name
        })

    def move_by_1(self, name, direction):
        return self._send_op('moveBy1', {
            'name': name,
            'direction': direction
        })


comm = Communicator()
