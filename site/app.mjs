const config=JSON.parse(document.getElementById('public-config').textContent);
document.documentElement.classList.add('js');
const menu=document.getElementById('menu-toggle'),nav=document.getElementById('site-nav');
function closeMenu() {menu.setAttribute('aria-expanded','false');nav.classList.remove('open');}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
window.matchMedia('(min-width: 901px)').addEventListener('change',e=>{if(e.matches)closeMenu();});

for(const button of document.querySelectorAll('.copy-code')) {
  button.addEventListener('click',async()=>{
    const block=button.closest('.code-block'),status=block.querySelector('.copy-status');
    try {await navigator.clipboard.writeText(block.querySelector('code').textContent);status.textContent='Commands copied.';}
    catch {status.textContent='Copy is unavailable in this browser. Select the commands to copy them.';}
  });
}

const form=document.getElementById('feedback-form');
if(form)form.querySelector('button[type="submit"]').disabled=false;
if(form)form.addEventListener('submit',e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const fields=new FormData(form);
  const summary=String(fields.get('summary')).trim(),details=String(fields.get('details')).trim(),kind=String(fields.get('kind'));
  if(summary.length<5||details.length<15)return;
  const title=`[${kind}] ${summary}`,body=`## ${kind}\n\n${details}\n\nShared from the Evir community page.`;
  document.getElementById('feedback-draft').textContent=`${title}\n\n${body}`;
  const target=new URL(config.feedback);
  if(target.hostname==='github.com'&&target.pathname.endsWith('/issues/new')) {
    target.searchParams.set('title',title);target.searchParams.set('body',body);
  }
  document.getElementById('feedback-link').href=target.href;
  const review=document.getElementById('feedback-review');review.hidden=false;review.focus();
});

async function startPreview(element) {
  const name=element.dataset.preview,canvas=element.querySelector('canvas'),poster=element.querySelector('.demo-poster');
  const toggle=element.querySelector('.motion-control'),wave=element.querySelector('.wave-control'),state=element.querySelector('.demo-state'),message=element.querySelector('.demo-message');
  try {
    const [{drawScene},{evaluate,MachinePlayer},response]=await Promise.all([
      import('./engine/render-scene.mjs'),import('./engine/motion.mjs'),fetch(`${config.basePath}/assets/examples/${name}.evir-project`)]);
    if(!response.ok)throw Error('Project could not load');
    const project=await response.json();
    const machine=project.machines.length?new MachinePlayer(project,project.machines[0].id):null;
    const animation=project.animations[0];
    const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    let playing=!motionPreference.matches,visible=true,last=0,time=0,waving=false,frame;
    const draw=(dt=0)=>{
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      time+=dt;
      const pose=machine?machine.advance(dt):evaluate(project,animation.id,(time*animation.fps)%animation.duration);
      drawScene(ctx,pose,project.artboards[0].id);
    };
    const sync=()=>{toggle.textContent=playing?'Pause motion':'Play motion';toggle.setAttribute('aria-pressed',String(playing));element.dataset.playing=String(playing);};
    const tick=(now)=>{if(playing&&visible&&!document.hidden)draw(last?Math.min((now-last)/1000,.05):0);last=now;frame=requestAnimationFrame(tick);};
    draw();canvas.hidden=false;poster.hidden=true;toggle.disabled=false;if(wave)wave.disabled=false;sync();element.dataset.ready='true';
    toggle.addEventListener('click',()=>{playing=!playing;last=0;sync();});
    motionPreference.addEventListener('change',e=>{if(e.matches){playing=false;sync();}});
    wave?.addEventListener('click',()=>{
      waving=!waving;machine.set(project.machines[0].inputs[0].id,waving);draw();
      wave.setAttribute('aria-pressed',String(waving));wave.firstChild.textContent=waving?'Back to idle ':'Say hello ';
      state.textContent=waving?'Hello':'Idle';
    });
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;},{threshold:.05}).observe(element);
    requestAnimationFrame(tick);
    window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
    window.addEventListener('pageshow',e=>{if(e.persisted){last=0;frame=requestAnimationFrame(tick);}});
  }catch(error){message.textContent='The live preview is unavailable. The example image and downloadable source are still available.';toggle.disabled=true;if(wave)wave.disabled=true;}
}
for(const element of document.querySelectorAll('[data-preview]'))startPreview(element);
