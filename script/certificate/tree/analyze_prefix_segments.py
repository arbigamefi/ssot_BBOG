#!/usr/bin/env python3
"""Diagnostic static CFG over exact solc bytecode; no EVM execution and no storage state.
Unknown values branch both ways. Recursive/tree child functions are opaque and separately
bounded structurally. Arithmetic helpers are analyzed recursively, not priced from Yul.
Numbers exclude SSTORE dynamic charge and memory expansion; unresolved CFG aborts.
"""
from pathlib import Path
from collections import defaultdict
import json
import sys
B=Path(__file__).resolve().parent
D=json.loads((B/'vault-solc-output.json').read_text())['contracts']['src/core/LiquidityVault.sol']['LiquidityVault']['evm']['deployedBytecode']
import hashlib
ID=json.loads((B/'compiler-identity.json').read_text())
assert hashlib.sha256(bytes.fromhex(D['object'])).hexdigest() == ID['runtimeSha256']
T=D['opcodes'].split(); OPS={}; i=pc=0
while i<len(T):
 op=T[i];i+=1;arg=None;n=1
 if op.startswith('PUSH')and op!='PUSH0':n+=int(op[4:]);arg=int(T[i],16);i+=1
 OPS[pc]=(op,arg,pc+n);pc+=n
DBG={v['entryPoint']:(k,v)for k,v in D['functionDebugData'].items()if v['entryPoint']is not None}
START={k:v['entryPoint']for k,v in D['functionDebugData'].items()if v['entryPoint']is not None}
TREE={'fun_push','fun_isNeedUpdateWholeLeaves','fun_pushLazy','fun_setAmount','fun_changeAmount','fun_getLeavesAmount','fun_prefixCovers'}
BASE={'STOP':0,'ADD':3,'SUB':3,'MUL':5,'DIV':5,'SDIV':5,'MOD':5,'SMOD':5,'ADDMOD':8,'MULMOD':8,'LT':3,'GT':3,'SLT':3,'SGT':3,'EQ':3,'ISZERO':3,'AND':3,'OR':3,'XOR':3,'NOT':3,'BYTE':3,'SHL':3,'SHR':3,'SAR':3,'POP':2,'MLOAD':3,'MSTORE':3,'MSTORE8':3,'SLOAD':100,'SSTORE':0,'JUMP':8,'JUMPI':10,'JUMPDEST':1,'RETURN':0,'REVERT':0,'INVALID':0}
U='?';RET='RET';MASK=(1<<256)-1;RESULT={};ACTIVE=set();ERRORS=[]
def calc(op,a):
 if any(not isinstance(x,int)for x in a):return U
 x=a[0];y=a[1]if len(a)>1 else None
 if op=='ADD':return(x+y)&MASK
 if op=='SUB':return(x-y)&MASK
 if op=='MUL':return(x*y)&MASK
 if op=='DIV':return 0 if y==0 else x//y
 if op=='MOD':return 0 if y==0 else x%y
 if op=='LT':return int(x<y)
 if op=='GT':return int(x>y)
 if op=='EQ':return int(x==y)
 if op=='ISZERO':return int(x==0)
 if op=='AND':return x&y
 if op=='OR':return x|y
 if op=='XOR':return x^y
 if op=='NOT':return MASK^x
 if op=='SHL':return 0 if x>=256 else(y<<x)&MASK
 if op=='SHR':return 0 if x>=256 else y>>x
 return U

def analyze(name,params=None,label=None,start_pc=None,initial_stack=None,stop_pcs=(),force_edges=None):
 label=label or name
 if label in RESULT:return RESULT[label]
 if label in ACTIVE:raise RuntimeError('unexpected helper cycle '+label)
 ACTIVE.add(label);start=START[name];spec=DBG[start][1]
 # The backend passes the first source parameter at the top of the EVM stack.
 stack=(RET,)+tuple(reversed(params)) if params is not None else (RET,)+(U,)*spec['parameterSlots']
 todo=[(start if start_pc is None else start_pc,stack if initial_stack is None else initial_stack,0,0,0,0)];groups={};stop_stacks={};seen={};maxima=defaultdict(int);success=fail=steps=0;calls=defaultdict(int);unresolved=[];retained=defaultdict(int)
 while todo:
  pc,st,gas,loads,stores,hashes=todo.pop();key=(pc,st);stats=(gas,loads,stores,hashes)
  if pc in stop_pcs and gas>0:
   key_=str(pc);old=groups.get(key_,(0,0,0,0));groups[key_]=tuple(max(a,b) for a,b in zip(stats,old));stop_stacks.setdefault(key_,[])
   if st not in stop_stacks[key_]:stop_stacks[key_].append(st)
   success+=1
   continue
  # Componentwise maxima retain every path if any relevant metric increases.
  previous=seen.get(key)
  if previous is not None and all(a<=b for a,b in zip(stats,previous)):continue
  seen[key]=tuple(max(a,b)for a,b in zip(stats,previous or(0,0,0,0)));steps+=1
  if steps>200000:raise RuntimeError('state limit / cycle '+name)
  s=list(st);maxima['maxLocalStackHeight']=max(maxima['maxLocalStackHeight'],len(s));op,arg,nxt=OPS[pc]
  def pop():
   if not s:raise RuntimeError(f'{name} stack underflow pc={pc} {op}')
   return s.pop()
  def finish():
   nonlocal success
   success+=1
   old=groups.get('RETURN',(0,0,0,0));groups['RETURN']=tuple(max(a,b) for a,b in zip((gas,loads,stores,hashes),old))
   for k,v in [('gas',gas),('sload',loads),('sstore',stores),('keccak64',hashes)]:maxima[k]=max(maxima[k],v)
  if op.startswith('PUSH'):
   s.append(0 if op=='PUSH0'else arg);gas+=2 if op=='PUSH0'else 3
  elif op.startswith('DUP'):
   s.append(s[-int(op[3:])]);gas+=3
  elif op.startswith('SWAP'):
   j=int(op[4:]);s[-1],s[-1-j]=s[-1-j],s[-1];gas+=3
  elif op=='KECCAK256':
   offset=pop();size=pop()
   if offset!=0 or size!=64:raise RuntimeError(f'{name} unbounded hash pc={pc} off={offset} size={size}')
   gas+=42;hashes+=1;s.append(U)
  elif op=='SLOAD':pop();s.append(U);gas+=100;loads+=1
  elif op=='SSTORE':pop();pop();stores+=1
  elif op in('MSTORE','MSTORE8'):
   offset=pop();pop()
   if not isinstance(offset,int)or offset>64:raise RuntimeError(f'{name} memory extent pc={pc} offset={offset}')
   gas+=BASE[op]
  elif op=='MLOAD':
   offset=pop()
   if not isinstance(offset,int)or offset>64:raise RuntimeError(f'{name} memory read extent pc={pc} offset={offset}')
   maxima['mloadCountInExploredStates']+=1
   maxima['maxMemoryReadOffset']=max(maxima['maxMemoryReadOffset'],offset)
   s.append(U);gas+=3
  elif op=='POP':pop();gas+=2
  elif op=='JUMPDEST':gas+=1
  elif op=='JUMPI':
   dest=pop();cond=pop();gas+=10
   if not isinstance(dest,int):raise RuntimeError(f'{name} symbolic conditional destination pc={pc}')
   if (cond==U or cond==RET or cond!=0) and (not force_edges or pc not in force_edges or dest==force_edges[pc]):todo.append((dest,tuple(s),gas,loads,stores,hashes))
   if (cond==U or cond==RET or cond==0) and (not force_edges or pc not in force_edges or nxt==force_edges[pc]):todo.append((nxt,tuple(s),gas,loads,stores,hashes))
   continue
  elif op=='JUMP':
   dest=pop();gas+=8
   if dest==RET:finish();continue
   if not isinstance(dest,int):raise RuntimeError(f'{name} unresolved jump pc={pc} dest={dest}')
   if dest in DBG:
    child,cs=DBG[dest];argc=cs['parameterSlots'];rets=cs['returnSlots'];ret=s[-argc-1]
    retained[child]=max(retained[child],len(s)-argc-1);calls[child]+=1
    del s[-argc-1:]
    if child not in TREE:
     cr=analyze(child);gas+=cr['gas'];loads+=cr['sload'];stores+=cr['sstore'];hashes+=cr['keccak64']
    s.extend((U,)*rets)
    if ret==RET:finish();continue
    if not isinstance(ret,int):raise RuntimeError(f'{name} unresolved return child={child} ret={ret}')
    nxt=ret
   else:nxt=dest
  elif op in('REVERT','RETURN','INVALID','STOP'):
   fail+=1;continue
  elif op in('ISZERO','NOT'):
   s.append(calc(op,[pop()]));gas+=BASE[op]
  elif op in('ADD','SUB','MUL','DIV','MOD','LT','GT','EQ','AND','OR','XOR','SHL','SHR'):
   a=pop();b=pop();s.append(calc(op,[a,b]));gas+=BASE[op]
  else:raise RuntimeError(f'{name} unsupported opcode {op} at {pc}')
  todo.append((nxt,tuple(s),gas,loads,stores,hashes))
 if not success:raise RuntimeError('no successful return '+name)
 out=dict(maxima,endpointGroups=groups,stopStacks=stop_stacks,successfulAbstractReturns=success,failedAbstractBranches=fail,abstractStates=steps,opaqueTreeCalls='separately charged; no recursive expansion',retainedStackAtChild=retained)
 ACTIVE.remove(label);RESULT[label]=out;return out

if __name__ == '__main__':
 # fun_prefixCovers (same offsets on Vault runtimes 844ba36c and 27d36335): loop head +54; JUMPIs +69
 # (end!=cutoff: jump continues the loop, fall exits), +99 (C>=k: jump is the early true return), +115 (C+A<k: jump
 # is the early false return), +251 (cutoff<=mid: fall goes left, jump goes right). fun_allocationLeaf: JUMPI +43
 # (cutoff==last: jump is the shortcut, fall evaluates the predicate); since B4 it has no k==0 branch.
 # PC binding (independent certificate review 2026-10-07, I-1): every forced branch must be a JUMPI whose
 # alternatives are exactly its fall-through and the PUSHed JUMPDEST before it, and every stop/start PC a JUMPDEST.
 # Anchors are function-relative (functionDebugData entry plus offset) and a forced branch names a side, 'jump'
 # (the PUSHed JUMPDEST) or 'fall'; its successor is derived from the bytecode, so a recompilation that only
 # moves functions keeps the anchors, and one that changes a body fails here.
 PREV={v[2]:k for k,v in OPS.items()}
 def head(fn,off):
  pc=START[fn]+off;assert OPS[pc][0]=='JUMPDEST',(fn,off,OPS[pc]);return pc
 def edge(fn,off,side):
  pc=START[fn]+off;op,_,nxt=OPS[pc];assert op=='JUMPI',(fn,off,op)
  pop,parg,_=OPS[PREV[pc]];assert pop.startswith('PUSH') and OPS[parg][0]=='JUMPDEST',(fn,off,pop,parg)
  return {pc:{'jump':parg,'fall':nxt}[side]}
 P=lambda off,side:edge('fun_prefixCovers',off,side)
 HEAD=head('fun_prefixCovers',54)
 init=analyze('fun_prefixCovers',label='predicate_entry',stop_pcs=(HEAD,))
 stacks=init['stopStacks'][str(HEAD)];assert len(stacks)==1
 loopstack=tuple(RET if v==RET else U for v in stacks[0])
 body={**P(69,'jump'),**P(99,'fall'),**P(115,'fall')}
 left=analyze('fun_prefixCovers',label='predicate_left',start_pc=HEAD,initial_stack=loopstack,stop_pcs=(HEAD,),force_edges={**body,**P(251,'fall')})
 right=analyze('fun_prefixCovers',label='predicate_right',start_pc=HEAD,initial_stack=loopstack,stop_pcs=(HEAD,),force_edges={**body,**P(251,'jump')})
 exit_=analyze('fun_prefixCovers',label='predicate_exit',start_pc=HEAD,initial_stack=loopstack,force_edges=P(69,'fall'))
 early_true=analyze('fun_prefixCovers',label='predicate_early_true',start_pc=HEAD,initial_stack=loopstack,force_edges={**P(69,'jump'),**P(99,'jump')})
 early_false=analyze('fun_prefixCovers',label='predicate_early_false',start_pc=HEAD,initial_stack=loopstack,force_edges={**P(69,'jump'),**P(99,'fall'),**P(115,'jump')})
 own=analyze('fun_allocationLeaf',label='selector_own',force_edges=edge('fun_allocationLeaf',43,'fall'))
 shortcut=analyze('fun_allocationLeaf',label='selector_shortcut',force_edges=edge('fun_allocationLeaf',43,'jump'))
 labels=['predicate_entry','predicate_left','predicate_right','predicate_exit','predicate_early_true','predicate_early_false','selector_own','selector_shortcut']
 out={'runtimeSha256':ID['runtimeSha256'],'loopHead':HEAD,'segments':{k:RESULT[k] for k in labels},'helpers':{k:v for k,v in RESULT.items() if k not in labels},'predicateOpaqueOnlyInsideSelector':True}
 (B/'prefix-success-cfg-segments.json').write_text(json.dumps(out,indent=2)+'\n')
 print(json.dumps({k:RESULT[k]['endpointGroups'] for k in labels},indent=2))
