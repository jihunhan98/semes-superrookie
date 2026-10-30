"use client";
import {useId,useMemo,useState} from "react";
import ReviewIcon from "./ReviewIcon";
import styles from "./ConsensusDocumentPreview.module.css";

export default function ConsensusDocumentPreview({content,expanded,onToggle,disabled=false}:{content:string;expanded:boolean;onToggle:()=>void;disabled?:boolean}){
 const [query,setQuery]=useState("");
 const inputId=useId();
 const matches=useMemo(()=>{
   const needle=query.trim(),found:{start:number;end:number}[]=[];
   if(!needle)return found;
   let cursor=0;
   while(cursor<content.length){const start=content.indexOf(needle,cursor);if(start<0)break;found.push({start,end:start+needle.length});cursor=start+needle.length;}
   return found;
 },[content,query]);
 const pieces=[];let cursor=0;
 for(const match of matches){pieces.push(content.slice(cursor,match.start));pieces.push(<mark key={match.start}>{content.slice(match.start,match.end)}</mark>);cursor=match.end;}
 pieces.push(content.slice(cursor));
 return <section className={`${styles.preview} ${expanded?styles.expanded:''}`} data-consensus-preview>
 <header><div><ReviewIcon name="file" size={18}/><h2>합의할 최종 본문</h2></div><button type="button" className={styles.expand} disabled={disabled} onClick={onToggle} aria-expanded={expanded}>{expanded?'합의 입력으로 돌아가기':'본문 크게 보기'}</button></header>
 <div className={styles.search}><label htmlFor={inputId}>본문 검색</label><input id={inputId} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="확인할 문구를 입력하세요" aria-label="합의할 최종 본문에서 검색"/><span role="status">{query.trim()?`${matches.length}곳 일치`:'전체 본문'}</span></div>
 <div className={styles.body} role="document" aria-label="합의할 최종 본문" tabIndex={0}>{pieces}</div>
 <footer><ReviewIcon name="info" size={13}/><span>{expanded?'본문 전체를 넓게 펼쳤습니다. 확인 후 합의 입력으로 돌아가세요.':'본문을 스크롤해 읽거나 크게 보기로 전체 너비에서 확인하세요.'}</span></footer>
 </section>;
}
