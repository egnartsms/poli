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

    def get_modules(self):
        return self._send_op('getModules', {})

    def get_entries(self):
        return self._send_op('getEntries', {})

    def get_defn(self, module, name):
        return self._send_op('getDefinition', {
            'module': module,
            'name': name
        })
    
    def get_module_entries(self, module):
        return self._send_op('getModuleEntries', {
            'module': module
        })

    def get_importables(self, recp_module):
        return self._send_op('getImportables', {
            'recp': recp_module,
        })

    def get_module_names(self, module):
        return self._send_op('getModuleNames', {
            'module': module
        })

    def edit(self, module, name, new_defn):
        return self._send_op('edit', {
            'module': module,
            'name': name,
            'newDefn': new_defn
        })

    def rename(self, module, old_name, new_name):
        return self._send_op('rename', {
            'module': module,
            'oldName': old_name,
            'newName': new_name
        })

    def add(self, module, name, defn, anchor, before):
        return self._send_op('add', {
            'module': module,
            'name': name,
            'defn': defn,
            'anchor': anchor,
            'before': before
        })

    def eval(self, module, code):
        return self._send_op('eval', {
            'module': module,
            'code': code
        })

    def delete(self, module, name):
        return self._send_op('delete', {
            'module': module,
            'name': name
        })

    def delete_cascade(self, module, name):
        return self._send_op('deleteCascade', {
            'module': module,
            'name': name
        })

    def move_by_1(self, module, name, direction):
        return self._send_op('moveBy1', {
            'module': module,
            'name': name,
            'direction': direction
        })

    def move(self, src_module, entry, dest_module, anchor, before):
        return self._send_op('move', {
            'srcModule': src_module,
            'entry': entry,
            'destModule': dest_module,
            'anchor': anchor,
            'before': before
        })

    def import_(self, recp_module, donor_module, name, alias):
        return self._send_op('import', {
            'recp': recp_module,
            'donor': donor_module,
            'name': name,
            'alias': alias or None
        })

    def remove_unused_imports(self, module):
        return self._send_op('removeUnusedImports', {
            'module': module
        })

    def remove_unused_imports_in_all_modules(self):
        return self._send_op('removeUnusedImportsInAllModules', {})

    def rename_import(self, module, imported_as, new_alias):
        return self._send_op('renameImport', {
            'module': module,
            'importedAs': imported_as,
            'newAlias': new_alias
        })

    def get_completions(self, module, prefix):
        return self._send_op('getCompletions', {
            'module': module,
            'prefix': prefix,
        })

    def find_references(self, module, name):
        return self._send_op('findReferences', {
            'module': module,
            'name': name
        })

    def add_module(self, module):
        return self._send_op('addModule', {
            'module': module
        })

    def rename_module(self, module, new_name):
        return self._send_op('renameModule', {
            'module': module,
            'newName': new_name
        })

    def refresh_module(self, module):
        return self._send_op('refreshModule', {
            'module': module
        })


comm = Communicator()
