// Original foreground cloud renderer. The landscape remains usable without WebGL.
export function createCloudScene(canvas) {
  let gl;
  try { gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,powerPreference:'low-power'}); } catch { return null; }
  if(!gl)return null;
  const vertex=`attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;
  const fragment=`precision mediump float;
    uniform vec2 resolution;uniform vec2 pointer;uniform float clock;uniform float density;uniform float depth;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.0-2.0*b);return mix(mix(hash(a),hash(a+vec2(1.,0.)),b.x),mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.,1.)),b.x),b.y);}
    float fbm(vec2 p){float v=.55*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p;v+=.28*noise(p+3.2);p=mat2(1.6,-1.2,1.2,1.6)*p;return v+.14*noise(p+7.1);}
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;float aspect=resolution.x/resolution.y;vec2 p=vec2(uv.x*aspect,uv.y);
      float alpha=0.;float light=0.;
      for(int i=0;i<5;i++){
        float layer=float(i);vec2 q=p*(2.5-layer*.25)+vec2(clock*(.019+layer*.004),clock*.003-layer*2.3)+pointer*depth*(layer+1.)*.06;
        float billow=fbm(q);float center=.16+layer*.065+.065*sin(uv.x*5.+layer+clock*.009);
        float band=exp(-pow((uv.y-center)/(.16+layer*.015),2.));
        float cloud=smoothstep(.37,.78,billow)*band*density*.30;
        float contribution=(1.-alpha)*cloud;alpha+=contribution;light+=contribution*(.83+.17*billow);
      }
      float brightness=alpha>.001?light/alpha:1.;vec3 color=mix(vec3(.63,.73,.76),vec3(.95,.97,.96),brightness);
      gl_FragColor=vec4(color,clamp(alpha,0.,.68));
    }`;
  const shaders=[];
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('Cloud shader unavailable');}shaders.push(shader);return shader;}
  let program,buffer;
  try{
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Cloud renderer unavailable');
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  }catch{if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);shaders.forEach(s=>gl.deleteShader(s));return null;}
  const locations=Object.fromEntries(['resolution','pointer','clock','density','depth'].map(key=>[key,gl.getUniformLocation(program,key)]));
  const controller=new AbortController();
  let active=true,paused=false,destroyed=false,unavailable=false,frame=0,last=0,time=0;
  let settings={density:.65,speed:.7,depth:.5},target={x:0,y:0},position={x:0,y:0};
  function draw(){
    if(destroyed||gl.isContextLost())return;
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
    gl.uniform2f(locations.resolution,canvas.width,canvas.height);gl.uniform2f(locations.pointer,position.x,position.y);
    gl.uniform1f(locations.clock,time);gl.uniform1f(locations.density,settings.density);gl.uniform1f(locations.depth,settings.depth);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function animate(now){
    frame=0;if(destroyed||unavailable||!active||paused||document.hidden||settings.speed===0)return;
    if(now-last>=40){const delta=last?Math.min((now-last)/1000,.1):0;time=(time+delta*settings.speed)%600;last=now;position.x+=(target.x-position.x)*.08;position.y+=(target.y-position.y)*.08;draw();}
    frame=requestAnimationFrame(animate);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=0;if(!unavailable&&active&&!paused&&!document.hidden&&settings.speed>0)frame=requestAnimationFrame(animate);else draw();}
  function resize(){if(destroyed)return;const rect=canvas.getBoundingClientRect();const scale=innerWidth<700?.6:.45;canvas.width=Math.max(200,Math.round(rect.width*scale));canvas.height=Math.max(200,Math.round(rect.height*scale));draw();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  window.addEventListener('pointermove',event=>{if(paused||!active)return;target.x=(event.clientX/innerWidth-.5)*2;target.y=(event.clientY/innerHeight-.5)*2;},{passive:true,signal:controller.signal});
  document.addEventListener('visibilitychange',sync,{signal:controller.signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();unavailable=true;canvas.hidden=true;cancelAnimationFrame(frame);frame=0;},{signal:controller.signal});
  resize();sync();
  return {
    configure(values){settings={...settings,...values};settings.density=Math.max(0,Math.min(settings.density,1));settings.speed=Math.max(0,Math.min(settings.speed,2));settings.depth=Math.max(0,Math.min(settings.depth,1));sync();},
    setActive(value){active=value;sync();},
    setPaused(value){paused=value;if(paused)position={x:0,y:0};sync();},
    destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();controller.abort();gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(shader=>gl.deleteShader(shader));},
  };
}
