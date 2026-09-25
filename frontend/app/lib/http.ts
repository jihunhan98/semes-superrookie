import { BACKEND } from "./api";
export class ApiError extends Error { constructor(message:string, readonly status:number){super(message);} }
export async function http<T>(path:string, init:RequestInit={}, signal?:AbortSignal):Promise<T>{
  const response=await fetch(`${BACKEND}${path}`,{...init,signal,headers:{"Content-Type":"application/json",...init.headers}});
  if(!response.ok){let message=`요청 실패 (${response.status})`;try{message=(await response.json()).message??message;}catch{}throw new ApiError(message,response.status);}
  if(response.status===204)return undefined as T;return response.json() as Promise<T>;
}
