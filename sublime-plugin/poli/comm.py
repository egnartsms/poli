import json
import websocket


import poli.config as config


class Communicator:
    def __init__(self):
        self.ws = None

    @property
    def is_connected(self):
        return self.ws is not None

    def connect(self):
        assert not self.is_connected

        self.ws = websocket.create_connection(
            'ws://localhost:{port}/'.format(port=config.port)
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
        res = self.ws.recv()
        print("Got this:", res)


comm = Communicator()
