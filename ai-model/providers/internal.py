from __future__ import annotations
import json
import re
import threading
import urllib.error
import urllib.request
from .base import Provider, ProviderError


def http_error(error, stage):
    # Preserve the upstream status and parameter name, never echo raw error bodies.
    parameter=None
    try:
        body=json.loads(error.read(4096).decode())
        value=body.get('error',{}).get('param')
        if isinstance(value,str) and re.fullmatch(r'[A-Za-z0-9_.\[\]-]{1,80}',value): parameter=value
    except Exception:
        pass
    return ProviderError(f'HTTP_{error.code}',error.code==429 or error.code>=500,
                         'internal provider request failed',stage=stage,upstream_status=error.code,parameter=parameter)


class InternalProvider(Provider):
    name = 'internal'

    def __init__(self, base: str, model: str, key: str, timeout: float):
        self.base,self.model,self.key,self.timeout=base,model,key,timeout
        self._resolved_model=None
        self._model_lock=threading.Lock()

    def resolve_model(self):
        if self.model!='auto': return self.model
        with self._model_lock:
            if self._resolved_model: return self._resolved_model
            req=urllib.request.Request(f'{self.base}/models',headers={'Authorization':f'Bearer {self.key}'})
            try:
                with urllib.request.urlopen(req,timeout=self.timeout) as res:
                    data=json.loads(res.read().decode()).get('data',[])
                model=data[0]['id']
                if not isinstance(model,str) or not model.strip(): raise ValueError('empty model')
                self._resolved_model=model
                return model
            except urllib.error.HTTPError as error:
                raise http_error(error,'model_discovery') from error
            except (TimeoutError,urllib.error.URLError) as error:
                timeout=isinstance(error,TimeoutError) or isinstance(getattr(error,'reason',None),TimeoutError)
                raise ProviderError('TIMEOUT' if timeout else 'UNAVAILABLE',True,'model discovery unavailable',stage='model_discovery') from error
            except Exception as error:
                raise ProviderError('MODEL_DISCOVERY_FAILED',False,'model discovery returned no valid model',stage='model_discovery') from error

    def generate(self, system: str, user: str) -> str:
        model=self.resolve_model()
        req=urllib.request.Request(f'{self.base}/chat/completions',data=json.dumps({'model':model,'messages':[{'role':'system','content':system},{'role':'user','content':user}],'temperature':0}).encode(),headers={'Content-Type':'application/json','Authorization':f'Bearer {self.key}'})
        try:
            with urllib.request.urlopen(req,timeout=self.timeout) as res: body=json.loads(res.read().decode())
            content=body['choices'][0]['message']['content']
            if not isinstance(content,str) or not content.strip(): raise ValueError('empty model response')
            return content
        except urllib.error.HTTPError as error:
            raise http_error(error,'generation') from error
        except (TimeoutError,urllib.error.URLError) as error:
            timeout=isinstance(error,TimeoutError) or isinstance(getattr(error,'reason',None),TimeoutError)
            raise ProviderError('TIMEOUT' if timeout else 'UNAVAILABLE',True,'internal provider unavailable') from error
        except Exception as error:
            raise ProviderError('INVALID_RESPONSE',False,'internal provider returned an invalid response') from error
