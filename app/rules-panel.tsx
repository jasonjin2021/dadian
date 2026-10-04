'use client';

import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {ACTIONS,type ActionDef,type ActionId,type Category} from '@/lib/game';
import {RULE_BASICS,RULE_CATEGORIES,RULES_GUIDE} from '@/lib/rules-guide';
import './rules-guide.css';

type Scope='basics'|'all'|Category;
type RuleDetail=(typeof RULES_GUIDE)[ActionId];
const categoryById=new Map(RULE_CATEGORIES.map(category=>[category.id,category]));

function Highlight({text,words}:{text:string;words:string[]}){
  if(!words.length)return <>{text}</>;
  const pattern=words.map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  return <>{text.split(new RegExp(`(${pattern})`,'gi')).map((part,index)=>words.includes(part.toLocaleLowerCase())?<mark key={index}>{part}</mark>:part)}</>;
}

function RuleBody({detail,words}:{detail:RuleDetail;words:string[]}){
  return <div className="rules-action-body">
    <dl>
      <div><dt>费用</dt><dd><Highlight text={detail.cost} words={words}/></dd></div>
      <div><dt>目标</dt><dd><Highlight text={detail.target} words={words}/></dd></div>
      <div><dt>效果</dt><dd><Highlight text={detail.effect} words={words}/></dd></div>
    </dl>
    {detail.interactions.length>0&&<section className="rules-interactions"><h4>特殊交互</h4><ul>{detail.interactions.map((interaction,index)=><li key={index}><Highlight text={interaction} words={words}/></li>)}</ul></section>}
    {detail.example&&<section className="rules-example"><h4>举个例子</h4><p><Highlight text={detail.example} words={words}/></p></section>}
  </div>;
}

function ActionRule({action,words,expanded,onToggle}:{action:ActionDef;words:string[];expanded:boolean;onToggle:()=>void}){
  const detail=RULES_GUIDE[action.id],category=categoryById.get(action.category),bodyId=useId();
  const searching=words.length>0;
  const title=<><span className="rules-category-letter" aria-hidden="true">{action.category}</span><span><strong><Highlight text={action.name} words={words}/></strong><small><Highlight text={`${action.category} · ${category?.name??''}`} words={words}/></small></span></>;
  return <article className={`rules-action-card ${expanded||searching?'is-open':''}`}>
    {searching?<h3 className="rules-action-search-title">{title}</h3>:<h3><button type="button" className="rules-action-toggle" aria-expanded={expanded} aria-controls={bodyId} onClick={onToggle}>{title}<span className="rules-expand-label" aria-hidden="true">{expanded?'收起 −':'展开 +'}</span></button></h3>}
    {!expanded&&!searching&&<p className="rules-action-preview">{detail.effect}</p>}
    <div id={bodyId} hidden={!expanded&&!searching}><RuleBody detail={detail} words={words}/></div>
  </article>;
}

export function Rules({onClose}:{onClose:()=>void}){
  const [query,setQuery]=useState(''),[scope,setScope]=useState<Scope>('basics'),[expanded,setExpanded]=useState<Set<ActionId>>(()=>new Set());
  const dialogRef=useRef<HTMLDialogElement>(null),titleRef=useRef<HTMLHeadingElement>(null),contentRef=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null);
  const titleId=useId(),descriptionId=useId(),searchId=useId(),contentId=useId();
  const words=useMemo(()=>Array.from(new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))),[query]);
  const searching=words.length>0,activeScope=searching?'all':scope;
  const matches=(text:string)=>words.every(word=>text.toLocaleLowerCase().includes(word));
  const basics=RULE_BASICS.filter(basic=>matches(`${basic.title} ${basic.body}`));
  const actions=ACTIONS.filter(action=>{
    if(!searching&&(scope==='basics'||scope!=='all'&&action.category!==scope))return false;
    const detail=RULES_GUIDE[action.id],category=categoryById.get(action.category);
    return matches([action.name,action.id,action.category,category?.name,category?.description,detail.cost,detail.target,detail.effect,...detail.interactions,detail.example].join(' '));
  });
  const visibleBasics=(searching||scope==='basics')?basics:[];
  const allExpanded=actions.length>0&&actions.every(action=>expanded.has(action.id));

  useEffect(()=>{
    const dialog=dialogRef.current;if(!dialog)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.showModal();
    // Start at the heading, so opening the guide does not summon a phone keyboard.
    titleRef.current?.focus({preventScroll:true});
    return()=>{if(dialog.open)dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);

  function selectScope(next:Scope){setScope(next);setQuery('');contentRef.current?.scrollTo({top:0});}
  function toggleAction(id:ActionId){setExpanded(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function toggleAll(){setExpanded(previous=>{const next=new Set(previous);actions.forEach(action=>{if(allExpanded)next.delete(action.id);else next.add(action.id);});return next;});}

  return <dialog ref={dialogRef} className="rules-guide" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="rules-guide-header"><div><p>玩法指南 · A–I 完整规则</p><h2 id={titleId} ref={titleRef} tabIndex={-1}>打点玩法与完整规则</h2><span id={descriptionId}>先读入门说明，再按类别查动作；也可以直接搜索费用、效果和特殊交互。</span></div><button type="button" className="rules-guide-close" onClick={onClose} aria-label="关闭规则">关闭 <span aria-hidden="true">×</span></button></header>
    <div className="rules-guide-controls">
      <label htmlFor={searchId}>搜索完整规则</label>
      <div className="rules-guide-search"><input ref={searchRef} id={searchId} type="search" value={query} onChange={event=>{setQuery(event.target.value);contentRef.current?.scrollTo({top:0});}} placeholder="动作名、类别、费用或特殊交互…" autoComplete="off" aria-controls={contentId}/>{query&&<button type="button" onClick={()=>{setQuery('');searchRef.current?.focus();}}>清除</button>}</div>
      <nav className="rules-guide-categories" aria-label="规则分类">
        {([{id:'basics',name:'入门说明'},{id:'all',name:'全部动作'},...RULE_CATEGORIES] as const).map(category=><button key={category.id} type="button" aria-pressed={activeScope===category.id} onClick={()=>selectScope(category.id)}><span className="rules-nav-check" aria-hidden="true">{activeScope===category.id?'✓':''}</span>{category.id!=='basics'&&category.id!=='all'&&<b>{category.id}</b>}<span>{category.name}</span></button>)}
      </nav>
    </div>
    <div className="rules-guide-results-bar"><p role="status" aria-live="polite">{searching?`搜索全部规则：${visibleBasics.length} 条入门说明，${actions.length} 个动作`:scope==='basics'?`${RULE_BASICS.length} 条入门说明`:`${scope==='all'?'全部动作':`${scope} · ${categoryById.get(scope)?.name}`} · ${actions.length} 个动作`}</p>{actions.length>0&&!searching&&<button type="button" onClick={toggleAll}>{allExpanded?'收起全部动作':'展开全部动作'}</button>}</div>
    <div ref={contentRef} id={contentId} className="rules-guide-content" tabIndex={0} aria-label="规则正文">
      {visibleBasics.length>0&&<section className="rules-basics"><h3>{searching?'匹配的入门说明':'先弄懂这一局'}</h3>{visibleBasics.map((basic,index)=><article key={basic.title}><span className="rules-basic-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><h4><Highlight text={basic.title} words={words}/></h4><p><Highlight text={basic.body} words={words}/></p></div></article>)}</section>}
      {scope==='basics'&&!searching&&<button className="rules-browse-all" type="button" onClick={()=>selectScope('all')}>接着查看全部 {ACTIONS.length} 个动作 <span aria-hidden="true">→</span></button>}
      {actions.length>0&&<section className="rules-action-list" aria-label={searching?'匹配的动作规则':'动作规则'}>{RULE_CATEGORIES.map(category=>{
        const group=actions.filter(action=>action.category===category.id);if(!group.length)return null;
        return <section key={category.id} className="rules-category-section"><header><h3><span>{category.id}</span> <Highlight text={category.name} words={words}/></h3><p><Highlight text={category.description} words={words}/></p></header>{group.map(action=><ActionRule key={action.id} action={action} words={words} expanded={expanded.has(action.id)} onToggle={()=>toggleAction(action.id)}/>)}</section>;
      })}</section>}
      {searching&&visibleBasics.length===0&&actions.length===0&&<div className="rules-guide-empty"><h3>没有找到匹配的规则</h3><p>试试缩短关键词，或按上方 A–I 分类浏览。</p><button type="button" onClick={()=>{setQuery('');setScope('all');searchRef.current?.focus();}}>清除搜索并查看全部动作</button></div>}
    </div>
    <footer className="rules-guide-footer"><span>搜索会展开匹配动作的完整内容。</span><span>按 Esc 可关闭</span></footer>
  </dialog>;
}
