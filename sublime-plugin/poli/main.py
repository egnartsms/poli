import sublime
import sublime_plugin

from poli.comm import comm
from poli.listener import *


def plugin_loaded():
    comm.connect()
    print("Loaded Poli")


def plugin_unloaded():
    comm.disconnect_if_connected()
    print("Unloaded Poli")
