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


handler = functools.partial(SPAHandler, directory=directory)
ThreadingHTTPServer(("0.0.0.0", port), handler).serve_forever()
