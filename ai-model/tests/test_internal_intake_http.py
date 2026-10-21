"""Exercise the real provider HTTP envelope through FastAPI, using a local LLM stub."""
import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from fastapi.testclient import TestClient
import main
from providers.internal import InternalProvider


@contextmanager
def upstream(chat_status=200, models_status=200, invalid_content=False):
    calls=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def respond(self,status,body):
            data=json.dumps(body,ensure_ascii=False).encode()
            self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
        def do_GET(self):
            calls.append((self.path,None))
            self.respond(models_status,{'data':[{'id':'local-model'}]})
        def do_POST(self):
            request=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            calls.append((self.path,request))
            if chat_status!=200:
                return self.respond(chat_status,{'error':{'param':'temperature','message':'PRIVATE_UPSTREAM_BODY'}})
            system=request['messages'][0]['content']
            result={'replacement':'통신 장애가 발생했을 때 작업을 시작한다.'} if '"replacement"' in system else {'terms':[]} if '"terms"' in system else {'findings':[]}
            self.respond(200,{'choices':[{'message':{'content':None if invalid_content else json.dumps(result,ensure_ascii=False)}}]})
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:yield f'http://127.0.0.1:{server.server_port}/v1',calls
    finally:server.shutdown();server.server_close();thread.join()


def answer(client):
    return client.post('/clarify-answer',json={'content':'필요 시 작업을 시작한다.','targetSpan':'필요 시 작업을 시작한다.','question':'언제 시작하나요?','answer':'통신 장애가 발생했을 때'})


def test_review_and_answer_use_same_model_endpoint_and_request_envelope(monkeypatch):
    with upstream() as (url,calls):
        monkeypatch.setattr(main,'PROVIDER',InternalProvider(url,'auto','test-key',2))
        client=TestClient(main.app)
        review=client.post('/analyze',json={'content':'필요 시 작업을 시작한다.','projectContext':{'name':'VCS','description':'Vehicle Control System'}})
        assert review.status_code==200
        assert review.json()['reviewStatus']=='COMPLETE'
        assert answer(client).json()['replacement']=='통신 장애가 발생했을 때 작업을 시작한다.'
        assert sum(path=='/v1/models' for path,_ in calls)==1
        payloads=[body for path,body in calls if path=='/v1/chat/completions']
        assert len(payloads)==3
        assert all(set(body)=={'model','messages','temperature'} for body in payloads)
        assert all(body['model']=='local-model' and body['temperature']==0 for body in payloads)
        assert all([m['role'] for m in body['messages']]==['system','user'] for body in payloads)


@pytest.mark.parametrize('upstream_status,local_status',[(400,502),(401,502),(422,502),(429,503),(503,503)])
def test_answer_preserves_upstream_status_instead_of_calling_everything_503(monkeypatch,upstream_status,local_status):
    with upstream(chat_status=upstream_status) as (url,calls):
        monkeypatch.setattr(main,'PROVIDER',InternalProvider(url,'local-model','test-key',2))
        response=answer(TestClient(main.app));detail=response.json()['detail']
        assert response.status_code==local_status
        assert detail['upstreamStatus']==upstream_status
        assert detail['code']==f'PROVIDER_HTTP_{upstream_status}'
        assert detail['stage']=='generation'
        assert 'temperature' in detail['message']
        assert 'PRIVATE_UPSTREAM_BODY' not in response.text


def test_model_discovery_failure_is_identified_before_post(monkeypatch):
    with upstream(models_status=403) as (url,calls):
        monkeypatch.setattr(main,'PROVIDER',InternalProvider(url,'auto','test-key',2))
        response=answer(TestClient(main.app))
        assert response.status_code==502
        assert response.json()['detail']['stage']=='model_discovery'
        assert response.json()['detail']['upstreamStatus']==403
        assert calls==[('/v1/models',None)]


def test_invalid_model_response_is_not_reported_as_connection_failure(monkeypatch):
    with upstream(invalid_content=True) as (url,calls):
        monkeypatch.setattr(main,'PROVIDER',InternalProvider(url,'local-model','test-key',2))
        response=answer(TestClient(main.app))
        assert response.status_code==502
        assert response.json()['detail']['code']=='PROVIDER_INVALID_RESPONSE'
