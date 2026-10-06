from __future__ import annotations
import json, urllib.error, urllib.request
from .base import Provider, ProviderError

class InternalProvider(Provider):
    name = "internal"
    def __init__(self, base: str, model: str, key: str, timeout: float): self.base,self.model,self.key,self.timeout=base,model,key,timeout
    def generate(self, system: str, user: str) -> str:
        model = self.model
        if model == "auto":
            try:
                models_req = urllib.request.Request(f"{self.base}/models", headers={"Authorization":f"Bearer {self.key}"})
                with urllib.request.urlopen(models_req,timeout=self.timeout) as res:
                    available = json.loads(res.read().decode()).get("data", [])
                model = available[0]["id"]
            except Exception as e:
                raise ProviderError("MODEL_DISCOVERY_FAILED",True,"internal provider model discovery failed") from e
        req=urllib.request.Request(f"{self.base}/chat/completions",data=json.dumps({"model":model,"messages":[{"role":"system","content":system},{"role":"user","content":user}],"temperature":0}).encode(),headers={"Content-Type":"application/json","Authorization":f"Bearer {self.key}"})
        try:
            with urllib.request.urlopen(req,timeout=self.timeout) as res: body=json.loads(res.read().decode())
            return body["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e: raise ProviderError(f"HTTP_{e.code}",e.code==429 or e.code>=500,"internal provider request failed") from e
        except TimeoutError as e: raise ProviderError("TIMEOUT",True,"internal provider timed out") from e
        except Exception as e: raise ProviderError("UNAVAILABLE",True,"internal provider unavailable") from e
