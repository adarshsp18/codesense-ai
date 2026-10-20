"""Start a real Uvicorn server, exercise HTTP, then stop only that process."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

root = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
env = {**os.environ, 'AI_ENABLED': 'false', 'OPENAI_API_KEY': ''}
process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)], cwd=root/'backend', env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
base = f'http://127.0.0.1:{port}'
try:
    for _ in range(80):
        try:
            with urlopen(base+'/health',timeout=1) as response:
                health=json.load(response)
            break
        except (URLError, TimeoutError):
            if process.poll() is not None:
                raise RuntimeError('Uvicorn failed to start: '+process.stderr.read().decode())
            time.sleep(.1)
    else:
        raise RuntimeError('Uvicorn health check timed out.')
    assert health['status'] == 'ok' and health['ai_configured'] is False
    with urlopen(base+'/guided-projects/todo',timeout=2) as response:
        assert len(json.load(response)['milestones']) == 2
    request=Request(base+'/mentor/hint',data=json.dumps({'milestone_id':'add-task','level':1}).encode(),headers={'Content-Type':'application/json'})
    with urlopen(request,timeout=2) as response:
        assert json.load(response)['source'] == 'Offline scripted hint'
    request=Request(base+'/roadmap/generate',data=json.dumps({'idea':'A library login page','level':'beginner'}).encode(),headers={'Content-Type':'application/json'})
    try:
        urlopen(request,timeout=2)
        raise AssertionError('Missing AI key must not produce a fake roadmap.')
    except HTTPError as error:
        assert error.code == 503
    print(json.dumps({'passed':True,'health':health,'checks':['real Uvicorn startup','health HTTP 200','guided project HTTP 200','offline hint HTTP 200','custom roadmap without key HTTP 503']},indent=2))
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
