import sublime
import sublime_plugin

from poli.comm import comm
from poli.view import *
from poli.sublime import *


def plugin_loaded():
    comm.connect()
    print("Loaded Poli")


def plugin_unloaded():
    comm.ensure_disconnected()
    print("Unloaded Poli")
