from __future__ import annotations
import json, urllib.error, urllib.parse, urllib.request
from .base import Provider, ProviderError

class GeminiProvider(Provider):
    name = "gemini"
    def __init__(self,key:str,model:str,timeout:float): self.key,self.model,self.timeout=key,model,timeout
    def generate(self,system:str,user:str)->str:
        url=f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(self.model)}:generateContent?key={urllib.parse.quote(self.key)}"
        req=urllib.request.Request(url,data=json.dumps({"systemInstruction":{"parts":[{"text":system}]},"contents":[{"role":"user","parts":[{"text":user}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode(),headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=self.timeout) as res: body=json.loads(res.read().decode())
            return body["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e: raise ProviderError(f"HTTP_{e.code}",e.code==429 or e.code>=500,"gemini request failed") from e
        except TimeoutError as e: raise ProviderError("TIMEOUT",True,"gemini timed out") from e
        except Exception as e: raise ProviderError("UNAVAILABLE",True,"gemini unavailable") from e
