// Reproducible, dependency-free GLB shell builder. Run with Node 20+.
// The GLB can be imported in Blender for further detailing and re-exported as glTF 2.0.
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
function buildNoraShell() {
  // Deterministic low-poly, vertex-painted cabin shell. Units: meters, Y-up.
  let state=1026;
  const rnd=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const choice=(a,b)=>a+(b-a)*rnd();
  const groups=["Logs","Endgrain","Planks","Shingles","Moss","Stone","Iron","Glass"];
  const geo={};for(const name of groups)geo[name]={p:[],n:[],c:[]};
  const wood=[0.34,0.275,0.21],endgrain=[0.42,0.32,0.22],plank=[0.39,0.33,0.26],roof=[0.27,0.26,0.22],moss=[0.27,0.33,0.20],stone=[0.44,0.44,0.42],metal=[0.18,0.19,0.19],glass=[0.24,0.31,0.33];
  const tint=(rgb,f=1)=>rgb.map(v=>Math.max(0.04,Math.min(0.95,v*f)));
  const v=(x,y,z)=>[x,y,z];
  function tri(g,a,b,c,col) {
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    const d=Math.hypot(...n)||1;for(let k=0;k<3;k++)n[k]/=d;
    const out=geo[g];
    for (let p of [a,b,c]){out.p.push(...p);out.n.push(...n);out.c.push(...col,1);}
  }
  function quad(g,a,b,c,d,col){tri(g,a,b,c,col);tri(g,a,c,d,col);}
  function cube(g,cx,cy,cz,sx,sy,sz,color,angle=0,pivotX=cx,pivotZ=cz) {
    const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
    const p=[
      v(x0,y0,z0),v(x1,y0,z0),v(x1,y1,z0),v(x0,y1,z0),
      v(x0,y0,z1),v(x1,y0,z1),v(x1,y1,z1),v(x0,y1,z1)
    ];
    const cs=Math.cos(angle),ss=Math.sin(angle);
    const q=p.map(a=>angle===0?a:v(pivotX+(a[0]-pivotX)*cs+(a[2]-pivotZ)*ss,a[1],pivotZ-(a[0]-pivotX)*ss+(a[2]-pivotZ)*cs));
    const faces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]];
    for(const f of faces)quad(g,q[f[0]],q[f[1]],q[f[2]],q[f[3]],tint(color,choice(.82,1.07)));
  }
  function timber(a,b,r,material=wood,segmentCount=null) {
    const alongX=Math.abs(b[0]-a[0])>Math.abs(b[2]-a[2]);
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    const cuts=segmentCount??Math.max(2,Math.ceil(length/1.35));
    const sides=8, rings=[];
    for(let i=0;i<=cuts;i++){
      const t=i/cuts,cx=a[0]*(1-t)+b[0]*t,cy=a[1]*(1-t)+b[1]*t,cz=a[2]*(1-t)+b[2]*t;
      const ring=[];
      for(let j=0;j<sides;j++){
        const ang=(j/sides)*Math.PI*2;
        const ra=r*choice(.92,1.08);
        ring.push(alongX?v(cx,cy+ra*Math.sin(ang),cz+ra*Math.cos(ang)):v(cx+ra*Math.cos(ang),cy+ra*Math.sin(ang),cz));
      }
      rings.push(ring);
    }
    for(let i=0;i<cuts;i++)for(let j=0;j<sides;j++){
      let h=(j+1)%sides;
      quad("Logs",rings[i][j],rings[i+1][j],rings[i+1][h],rings[i][h],
           tint(material,choice(.80,1.08)*(j===0?.90:1)));
    }
    let ca=a,cb=b;
    for(let j=0;j<sides;j++){
      tri("Endgrain",ca,rings[0][(j+1)%sides],rings[0][j],tint(endgrain,choice(.90,1.08)));
      tri("Endgrain",cb,rings[cuts][j],rings[cuts][(j+1)%sides],tint(endgrain,choice(.90,1.08)));
    }
  }
  function subtractIntervals(span,openings,y){
    let result=[span];
    for(let h of openings){if(y-.12>=h[3] || y+.12<=h[2])continue;
      const next=[];for(const p of result){
        if(h[1]<=p[0]||h[0]>=p[1]){next.push(p);continue;}
        if(h[0]>p[0])next.push([p[0],h[0]]);
        if(h[1]<p[1])next.push([h[1],p[1]]);
      } result=next;
    }
    return result.filter(p=>p[1]-p[0]>.08);
  }
  const frontOpen=[[-2.4,-1.2,.95,1.75],[.9,1.9,-1,1.95],[3.0,3.6,1.05,1.65]];
  const backOpen=[[2.2,3.0,1.1,1.75]];
  const rightOpen=[[-1.6,-.9,1.1,1.7]];
  for(let k=0;k<11;k++){
    const y=.13+k*.221;
    for(const [a,b] of subtractIntervals([-4.73,4.73],frontOpen,y)) timber(v(a,y,3.5),v(b,y,3.5),.13);
    for(const [a,b] of subtractIntervals([-4.73,4.73],backOpen,y)) timber(v(a,y,-3.5),v(b,y,-3.5),.13);
    for(const [a,b] of subtractIntervals([-3.73,3.73],[],y+.065)) timber(v(-4.5,y+.065,a),v(-4.5,y+.065,b),.13);
    for(const [a,b] of subtractIntervals([-3.73,3.73],rightOpen,y+.065)) timber(v(4.5,y+.065,a),v(4.5,y+.065,b),.13);
  }
  for(let i=0;i<8;i++){
    const y=2.5+i*.219,fr=Math.max(.17,1-(y-2.4)/1.9);
    for(const xx of [-4.5,4.5])timber(v(xx,y,-3.5*fr),v(xx,y,3.5*fr),.125,wood);
  }
  // Floor: separate uneven old planks; small gaps are intentional.
  for(let i=0;i<19;i++){
    let z=-3.37+i*.372;
    cube("Planks",0,.005,z,8.86,.055,.35,tint(plank,choice(.75,1.13)));
  }
  // Frames for front door and two windows, rear window, one side window.
  function frontWindow(x0,x1,y0,y1,z,shutters=true){
    cube("Glass",(x0+x1)/2,(y0+y1)/2,z,.01+(x1-x0),y1-y0,.03,glass);
    for(const x of [x0,x1])cube("Planks",x,(y0+y1)/2,z+.11,.13,y1-y0+.22,.20,tint(plank,.9));
    for(const y of [y0,y1])cube("Planks",(x0+x1)/2,y,z+.11,x1-x0+.16,.14,.20,tint(plank,.88));
    cube("Planks",(x0+x1)/2,(y0+y1)/2,z+.14,.052,y1-y0,.075,tint(plank,.75));
    cube("Planks",(x0+x1)/2,(y0+y1)/2,z+.14,x1-x0,.054,.075,tint(plank,.75));
    if(shutters){
      const width=(x1-x0)/2;
      for(const s of [-1,1]){
        const cx=s===-1?x0-width/2-.13:x1+width/2+.13;
        cube("Planks",cx,(y0+y1)/2,z+.15,width-.06,y1-y0,.075,tint(plank,choice(.68,.82)));
        for(const yy of [y0+.20,y1-.20])cube("Iron",cx,yy,z+.21,width-.09,.025,.028,metal);
      }
    }
  }
  frontWindow(-2.4,-1.2,.95,1.75,3.5,true);
  frontWindow(3,3.6,1.05,1.65,3.5,false);
  frontWindow(2.2,3.0,1.1,1.75,-3.5,false);
  // Side window along X=4.5, place glass in YZ with timber edging.
  cube("Glass",4.51,1.4,-1.25,.04,.6,.7,glass);
  for(let zz of [-1.6,-.9])cube("Planks",4.58,1.4,zz,.13,.78,.13,plank);
  for(let yy of [1.1,1.7])cube("Planks",4.58,yy,-1.25,.13,.13,.83,plank);
  // Door is hinged on its left side and pushed inward 70°, matching the prototype collision.
  const hingeX=.9,hingeZ=3.5,theta=70*Math.PI/180;
  for(let i=0;i<5;i++){
    cube("Planks",hingeX+.105+i*.2,1.0,hingeZ,.195,1.91,.095,tint(plank,choice(.71,.90)),theta,hingeX,hingeZ);
  }
  for(let h of [.32,1.63])cube("Planks",hingeX+.49,h,hingeZ-.075,.93,.09,.06,tint(plank,.72),theta,hingeX,hingeZ);
  cube("Iron",hingeX+.88,.99,hingeZ-.11,.055,.14,.06,metal,theta,hingeX,hingeZ);
  for(let xx of [.85,1.95])cube("Planks",xx,1.04,3.5,.16,2.16,.26,tint(plank,.80));
  cube("Planks",1.4,2.07,3.5,1.32,.18,.27,tint(plank,.77));
  cube("Stone",1.4,.075,3.72,1.25,.15,.60,tint(stone,.73));
  // Roof: gable along X, slopes towards +/-Z. Multiple layered boards/shingles.
  const slope=z=>4.3-(1.9/3.5)*Math.abs(z);
  function slopedQuad(g,x0,x1,z0,z1,lift,thick,col) {
    const p=[
      v(x0,slope(z0)+lift,z0),v(x1,slope(z0)+lift,z0),
      v(x1,slope(z1)+lift,z1),v(x0,slope(z1)+lift,z1)
    ];
    const q=p.map(a=>v(a[0],a[1]-thick,a[2]));
    quad(g,p[0],p[1],p[2],p[3],col);
    quad(g,q[3],q[2],q[1],q[0],tint(col,.78));
    for(let i=0;i<4;i++)quad(g,p[i],q[i],q[(i+1)%4],p[(i+1)%4],tint(col,.76));
  }
  for(let side of [-1,1]){
    const z0=side*.02,z1=side*4.08;
    slopedQuad("Planks",-5.05,5.05,z0,z1,-.06,.13,tint(plank,.57));
    for(let row=0;row<12;row++){
      const za=side*(.035+row*.339),zb=side*(.38+row*.339);
      for(let j=0;j<29;j++){
        const shift=row%2?.14:0,xa=-4.98+j*.346+shift,xb=xa+.342;
        if(xb>5.05)continue;
        slopedQuad("Shingles",xa,xb,za,zb,.025+choice(0,.025),.034,tint(roof,choice(.68,1.13)));
        const mossChance=row<6?.24:.16;
        if(rnd()<mossChance)slopedQuad("Moss",xa+.02,xb-.02,za+side*.05,zb-side*.05,.069,.012,tint(moss,choice(.72,1.11)));
      }
    }
    // Exposed eave edge boards and fascia for a thick roof silhouette.
    cube("Planks",0,slope(4.08)-.15,side*4.06,10.2,.19,.12,tint(plank,.60));
  }
  cube("Planks",0,4.32,0,10.24,.13,.26,tint(plank,.65));
  // Smoke chimney on left roof-side, tied to hearth coordinates; no external lantern.
  for(let level=0;level<12;level++){
    const y=2.45+level*.235;
    const dx=(level%2)*.10;
    for(let xx of [-4.40,-3.87]){
      for(let zz of [.58,1.14]){
        cube("Stone",xx+dx*.12,y,zz,.57,.247,.60,tint(stone,choice(.73,1.12)));
      }
    }
  }
  cube("Stone",-4.14,5.35,.85,1.30,.23,1.25,tint(stone,.60));
  cube("Stone",-4.14,5.46,.85,1.15,.10,1.11,tint(stone,.77));
  // Fascia, roof supports and hand-hewn supports.
  for(let xx=-4.3;xx<=4.31;xx+=1.2)for(let sign of [-1,1]){
    cube("Planks",xx,2.33,sign*3.76,.18,.28,.70,tint(plank,choice(.69,.86)));
  }
  // Decorative pegs and metal door hardware, not modern objects.
  for(let y of [.31,1.66]){
    cube("Iron",1.03,y,3.56,.13,.10,.05,metal);
  }
  const descriptors=[
    ["Logs",.94],["Endgrain",.93],["Planks",.92],["Shingles",.94],
    ["Moss",1],["Stone",.99],["Iron",.65],["Glass",.34]
  ];
  // Assemble a standard GLB 2.0 with one named, independently editable mesh per material group.
  const binary=[],views=[],acc=[],meshes=[],nodes=[],materials=[];
  function addFloats(nums,components,attributeName) {
    const begin=binary.length;
    const bytes=new Uint8Array(nums.length*4),dv=new DataView(bytes.buffer);
    for(let i=0;i<nums.length;i++)dv.setFloat32(i*4,nums[i],true);
    for(let i=0;i<bytes.length;i++)binary.push(bytes[i]);
    views.push({buffer:0,byteOffset:begin,byteLength:bytes.length,target:34962});
    const aa={bufferView:views.length-1,componentType:5126,count:nums.length/components,
              type:components===3?"VEC3":"VEC4"};
    if(attributeName==="POSITION"){
      const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<nums.length;i+=3)for(let k=0;k<3;k++){
        lo[k]=Math.min(lo[k],nums[i+k]);hi[k]=Math.max(hi[k],nums[i+k]);
      }
      aa.min=lo;aa.max=hi;
    }
    acc.push(aa);
    return acc.length-1;
  }
  for(let i=0;i<descriptors.length;i++){
    let [name,roughness]=descriptors[i],g=geo[name];
    if(!g.p.length)continue;
    materials.push({name,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:roughness},
                    doubleSided:true});
    const attrs={POSITION:addFloats(g.p,3,"POSITION"),
                 NORMAL:addFloats(g.n,3,"NORMAL"),
                 COLOR_0:addFloats(g.c,4,"COLOR_0")};
    meshes.push({name,primitives:[{attributes:attrs,material:materials.length-1,mode:4}]});
    nodes.push({name,mesh:meshes.length-1});
  }
  const doc={asset:{version:"2.0",generator:"Nora procedural shell / PS2 inspired"},
             scene:0,scenes:[{name:"Nora_Shell",nodes:nodes.map((_,i)=>i)}],
             nodes,meshes,materials,
             buffers:[{byteLength:binary.length}],bufferViews:views,accessors:acc};
  const json=JSON.stringify(doc),jsonbytes=[];
  for(let i=0;i<json.length;i++)jsonbytes.push(json.charCodeAt(i));
  while(jsonbytes.length%4)jsonbytes.push(32);
  while(binary.length%4)binary.push(0);
  const total=12+8+jsonbytes.length+8+binary.length,out=new Uint8Array(total),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);
  dv.setUint32(12,jsonbytes.length,true);dv.setUint32(16,0x4e4f534a,true);
  out.set(jsonbytes,20);
  let cursor=20+jsonbytes.length;
  dv.setUint32(cursor,binary.length,true);dv.setUint32(cursor+4,0x004e4942,true);cursor+=8;
  out.set(binary,cursor);
  return out;
}
const output=join(dirname(fileURLToPath(import.meta.url)),'..','models','nora_shell.glb');
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,buildNoraShell());
console.log('Created',output);
