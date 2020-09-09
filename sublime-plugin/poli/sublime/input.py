import re
import sublime_plugin


class ChainableInputHandler(sublime_plugin.CommandInputHandler):
    @classmethod
    def name(cls):
        """We need this before an instance is created"""
        def repl(m):
            return m.group().lower() if m.start() == 0 else '_' + m.group().lower()

        name = re.sub(r'(?<![A-Z])[A-Z]', repl, cls.__name__)
        if name.endswith("_input_handler"):
            name = name[0:-len("_input_handler")]

        return name

    def next_input(self, args):
        return chain_input_handlers(self.view, args, self.chain_tail)

    def __init__(self, view, chain_tail):
        self.view = view
        self.chain_tail = chain_tail


def chain_input_handlers(view, args, handler_classes):
    if not handler_classes:
        return None

    head, *chain_tail = handler_classes

    if head.name() in args:
        return chain_input_handlers(view, args, chain_tail)
    else:
        return head(view, args, chain_tail)


def run_command_thru_palette(window, cmd, args):
    window.run_command(
        'show_overlay',
        {
            'overlay': 'command_palette',
            'command': cmd,
            'args': args,
        }
    )
