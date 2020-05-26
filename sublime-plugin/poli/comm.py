import threading
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
        self.ws = websocket.create_connection('ws://localhost:{port}/'.format(port=config.port))

    def disconnect(self):
        assert self.is_connected
        self.ws.close()
        self.ws = None

    def disconnect_if_connected(self):
        if self.is_connected:
            self.disconnect()


comm = Communicator()
