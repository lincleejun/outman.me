// node test.mjs — checks the tracer in index.html against numbers printed in the patents / Zemax.
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const code=src.slice(src.indexOf('/*OPTICS*/'),src.indexOf('/*END*/'));
const O=new Function(code+';return {LENSES,buildLens,focusExt,aimChief,trace,spot,rms,norm,WL,groups,fan};')();
const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};

const son=O.buildLens(O.LENSES.sonnar1934);
ok(Math.abs(son.efl-92.55012)<.01&&Math.abs(son.bfl-34.75113)<.01,`Sonnar EFL ${son.efl.toFixed(3)} BFL ${son.bfl.toFixed(3)} (Zemax 92.550 / 34.751)`);

const L=O.buildLens(O.LENSES.summilux35aa);
ok(Math.abs(L.efl-35)<.5,`Summilux EFL ${L.efl.toFixed(3)} mm (patent f=35)`);
ok(Math.abs(L.bfl-19.595)<.3,`paraxial BFL ${L.bfl.toFixed(3)} vs patent intercept 19.595`);
// distortion: chief ray from a field angle whose real image height is ~12 / 21 mm (patent: -0.871% / -1.061%)
for(const [y0,want] of [[12,-.871],[21,-1.061]]){
  let th=Math.atan(y0/L.efl);for(let i=0;i<5;i++){const P=[0,1e7*Math.tan(th),L.sensorZ-1e7],{c}=O.aimChief(L,P,0);
    const r=O.trace(L,P,O.norm([c[0]-P[0],c[1]-P[1],c[2]-P[2]]),O.WL.G,0,1e9,null,false);th*=y0/-r.y;
    if(i===4){const d=(-r.y-L.efl*Math.tan(th))/(L.efl*Math.tan(th))*100;ok(Math.abs(d-want)<.35,`distortion at y'=${y0}: ${d.toFixed(3)}% (patent ${want}%)`);}}}
// close focus: patent says 0.7 m at 1:17.5
const e=O.focusExt(L,700);const m=e/L.efl;   // unit focusing: extension = f·m
ok(Math.abs(1/m-17.5)<1.2,`0.7 m: extension ${e.toFixed(3)} mm, magnification 1:${(1/m).toFixed(1)} (patent 1:17.5)`);
// on-axis at ∞, f/1.4 vs f/5.6: patent says aberrations < 20 µm; stopping down must tighten the spot
const P=[0,0,L.sensorZ-1e7],r14=O.rms(O.spot(L,P,1.4,0,[O.WL.G],41)).r,r56=O.rms(O.spot(L,P,5.6,0,[O.WL.G],41)).r;
ok(r14<.03&&r56<r14,`axial spot rms f/1.4 ${(r14*1e3).toFixed(1)} µm, f/5.6 ${(r56*1e3).toFixed(1)} µm`);
const sb=O.rms(O.spot(son,[0,0,son.sensorZ-1e7],1.5,0,[O.WL.G],41)).r;
ok(son.focusShift<0&&sb<.1,`Sonnar best focus ${son.focusShift.toFixed(3)} mm from paraxial, axial rms f/1.5 ${(sb*1e3).toFixed(0)} µm`);
// patent claim 2: components 1..4 are + − + + (5 is claimed −; paraxially it comes out ~0, a corrector)
const g=O.groups(L).map(g=>g.phi);ok(g[0]>0&&g[1]<0&&g[2]>0&&g[3]>0&&Math.abs(1/g[4])>400,`group powers f = ${g.map(p=>(1/p).toFixed(0)).join(' / ')} mm`);
// the iris must stop the outer rays of an f/1.4 fan at f/8, and stop them AT the stop surface
const fr=O.fan(L,[0,0,L.sensorZ-2000],8,0,O.WL.G);ok(fr.some(r=>r.ok)&&fr.filter(r=>!r.ok).every(r=>r.hit===L.stopIdx),'f/8: outer rays end on the iris');
