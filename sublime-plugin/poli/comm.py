import json
import poli.config as config
import websocket

from poli.exc import make_backend_error


class Communicator:
    def __init__(self):
        self.ws = None

    @property
    def is_connected(self):
        return self.ws is not None

    def reconnect(self):
        self.ensure_disconnected()
        self.ws = websocket.create_connection(
            'ws://localhost:{port}/'.format(port=config.port),
            timeout=config.socket_timeout
        )

    def ensure_disconnected(self):
        if self.ws is not None:
            self.ws.close()
            self.ws = None

    def send_op(self, op, args):
        self.ws.send(json.dumps({
            'op': op,
            'args': args
        }))

        res = json.loads(self.ws.recv())

        if res['success']:
            return res['result']
        else:
            raise make_backend_error(res['error'], res['info'])

    def get_defn(self, name):
        return self.send_op('getDefinition', {
            'name': name
        })

    def edit(self, name, new_defn):
        return self.send_op('edit', {
            'name': name,
            'newDefn': new_defn
        })


comm = Communicator()
