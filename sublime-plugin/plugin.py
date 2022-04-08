import os.path
import sys

poli_package = os.path.abspath(os.path.join(__file__, '..'))
if poli_package not in sys.path:
    sys.path.append(poli_package)


import sublime

from poli.main import *  # noqa
