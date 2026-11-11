"""Static file server with an SPA fallback for the exported app.

Serves files from app/dist; any unknown path falls back to
index.html so client-side routes like /planner survive a refresh.
"""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

directory = sys.argv[1] if len(sys.argv) > 1 else "dist"
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8094


class SPAHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not self.path.startswith("/_expo"):
            self.path = "/index.html"
        return super().send_head()

    def log_message(self, fmt, *args):
        pass


class Server(ThreadingHTTPServer):
    # The default backlog is 5 connections. Several browsers loading
    # the app at once (the Playwright workers) overflow it, and the
    # OS resets the extra connections.
    request_queue_size = 128


handler = functools.partial(SPAHandler, directory=directory)
Server(("0.0.0.0", port), handler).serve_forever()
