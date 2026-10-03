"""
Serves the ./frontend folder at http://127.0.0.1:5500 with the correct content types.
(On some Windows PCs the registry maps .css to text/plain, which makes browsers ignore the stylesheet.)
Run from the project root:   python serve_frontend.py
"""
import http.server, os, functools

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
PORT = 5500

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        ".css": "text/css", ".js": "text/javascript", ".html": "text/html",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # always load the newest files while developing
        super().end_headers()

if __name__ == "__main__":
    handler = functools.partial(Handler, directory=FRONTEND_DIR)
    print(f"Serving {FRONTEND_DIR}\nOpen http://127.0.0.1:{PORT}   (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()