import {createFeedback} from '@evir/ui';
import {createMotionLoop} from './motion-loop.mjs';
const config=JSON.parse(document.getElementById('public-config').textContent);
const feedback=createFeedback(document.getElementById('site-notice'));
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
    try {await navigator.clipboard.writeText(block.querySelector('code').textContent);status.textContent='Commands copied.';feedback.show('Commands copied.','success');}
    catch {status.textContent='Copy is unavailable. Select the commands to copy them.';feedback.show(status.textContent);}
  });
}
const form=document.getElementById('feedback-form');
if(form)form.querySelector('button[type="submit"]').disabled=false;
if(form)form.addEventListener('submit',e=>{
  e.preventDefault();
  const fields=new FormData(form),summary=String(fields.get('summary')).trim(),details=String(fields.get('details')).trim(),kind=String(fields.get('kind'));
  let first;
  for(const [name,value,min,max] of [['summary',summary,5,140],['details',details,15,5000]]) {
    const input=form.elements[name],error=document.getElementById(`${name}-error`);
    const invalid=value.length<min||value.length>max;
    input.setAttribute('aria-invalid',String(invalid));error.textContent=invalid?`Please enter between ${min} and ${max} characters.`:'';
    if(invalid&&!first)first=input;
  }
  if(first){document.getElementById('feedback-review').hidden=true;feedback.show('Your feedback needs a little more detail. Check the highlighted fields.');first.focus();return;}
  feedback.clear();
  const title=`[${kind}] ${summary}`,body=`## ${kind}\n\n${details}\n\nShared from the Evir community page.`;
  document.getElementById('feedback-draft').textContent=`${title}\n\n${body}`;
  const target=new URL(config.feedback);
  if(target.hostname==='github.com'&&target.pathname.endsWith('/issues/new')) {target.searchParams.set('title',title);target.searchParams.set('body',body);}
  document.getElementById('feedback-link').href=target.href;
  const review=document.getElementById('feedback-review');review.hidden=false;review.focus();
});
function mountPreview(element) {
  const name=element.dataset.preview,canvas=element.querySelector('canvas'),poster=element.querySelector('.demo-poster');
  const toggle=element.querySelector('.motion-control'),wave=element.querySelector('.wave-control'),state=element.querySelector('.demo-state'),message=element.querySelector('.demo-message');
  const expression=element.querySelector('.character-expression'),characterReset=element.querySelector('.character-reset');
  const blendInput=element.querySelector('.blend-input'),blendOn=element.querySelector('.blend-active');
  const loader=element.querySelector('.living-loader'),retry=element.querySelector('.retry-preview'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const enabled=element.querySelector('.enabled-control'),level=element.querySelector('.level-control'),celebrate=element.querySelector('.celebrate-control'),reset=element.querySelector('.reset-control');
  const motorcycle=name==='motorcycle',throttle=element.querySelector('.throttle-control'),brake=element.querySelector('.brake-control'),bump=element.querySelector('.bump-control'),headlight=element.querySelector('.headlight-control'),roughRoad=element.querySelector('.rough-road-control'),rideReset=element.querySelector('.ride-reset');
  const turnSignal=element.querySelector('.turn-signal-control');
  loader.hidden=true;element.setAttribute('aria-busy','false');
  const lifetime=new AbortController();let started=false,attempt,player,renderer,playing=!motion.matches,visible=false,suspended=false,waving=false,animated=true;
  if(motorcycle)playing=false;
  const loop=createMotionLoop(dt=>{renderer.draw(player.advance(dt),player.artboard.id);syncState();if(player.playback?.completed){playing=false;sync();}},{onError:fail});
  function syncState() {
    const telemetry=player?.telemetry;
    const current=telemetry?(telemetry.braking?'Braking':telemetry.speed>.05?'Cruising':'Parked'):player?.state?.name;
    if(current){if(state.textContent!==current)state.textContent=current;if(celebrate)celebrate.disabled=current!=='Ready';}
    if(telemetry){element.querySelector('.ride-speed').textContent=telemetry.speedKmh.toFixed(0);element.querySelector('.ride-distance').textContent=telemetry.distance.toFixed(0);}
  }
  function draw() {renderer.draw(player.advance(0),player.artboard.id);syncState();}
  function sync() {toggle.textContent=animated?(motorcycle?(playing?'Pause ride':'Start ride'):(playing?'Pause motion':'Play motion')):'Static study';toggle.setAttribute('aria-pressed',String(playing));element.dataset.playing=String(playing);loop.setActive(Boolean(animated&&player&&playing&&visible&&!document.hidden&&!suspended));}
  function fail() {
    loop.stop();player=null;renderer?.dispose();renderer=null;canvas.hidden=true;poster.hidden=false;
    loader.hidden=true;retry.hidden=false;element.setAttribute('aria-busy','false');delete element.dataset.ready;
    message.textContent='The live preview couldn’t wake up. Try again, or use the image and downloadable source.';
    toggle.disabled=true;if(wave)wave.disabled=true;for(const control of [enabled,level,celebrate,reset,blendInput,blendOn])if(control)control.disabled=true;
    for(const control of [expression,characterReset])if(control)control.disabled=true;
    for(const control of element.querySelectorAll('[data-motor-control]'))control.disabled=true;
  }
  async function load() {
    started=true;attempt?.abort();const current=attempt=new AbortController();
    loader.hidden=false;retry.hidden=true;message.textContent='';element.setAttribute('aria-busy','true');
    let preparingRenderer;
    try {
      const [{createRuntime},{CanvasRenderer},response]=await Promise.all([
        import('@evir/runtime'),import('@evir/renderer-canvas'),fetch(`${config.basePath}/assets/examples/${name}.evir-project`,{signal:current.signal})]);
      if(!response.ok)throw Error('Project could not load');const project=await response.json();
      if(current.signal.aborted)return;
      const nextPlayer=motorcycle?new (await import('./motorcycle.mjs')).MotorcycleController(project):createRuntime(project,project.machines.length?{machineId:project.machines[0].id}:{animationId:project.animations[0]?.id});preparingRenderer=new CanvasRenderer(canvas.getContext('2d'));
      await preparingRenderer.prepare(project);if(current.signal.aborted){preparingRenderer.dispose();return;}
      renderer?.dispose();renderer=preparingRenderer;preparingRenderer=null;player=nextPlayer;
      animated=Boolean(project.animations.length||project.machines.length);if(!animated)playing=false;
      draw();waving=false;if(blendInput){blendInput.disabled=false;blendOn.disabled=false;}
      if(enabled){enabled.checked=false;enabled.disabled=false;level.value='0';level.disabled=false;reset.disabled=false;element.querySelector('.level-value').textContent='0';}
      if(expression){expression.value='0';expression.disabled=false;characterReset.disabled=false;}
      if(wave){wave.setAttribute('aria-pressed','false');wave.firstChild.textContent='Say hello ';state.textContent='Idle';wave.disabled=false;}
      if(motorcycle){for(const control of element.querySelectorAll('[data-motor-control]'))control.disabled=false;resetRideControls();}
      canvas.hidden=false;poster.hidden=true;loader.hidden=true;toggle.disabled=!animated;
      element.setAttribute('aria-busy','false');element.dataset.ready='true';sync();
    } catch(error) {preparingRenderer?.dispose();if(!current.signal.aborted)fail();}
  }
  const options={signal:lifetime.signal};
  toggle.addEventListener('click',()=>{if(!playing&&player?.playback?.completed)player.reset();playing=!playing;sync();},options);
  motion.addEventListener('change',e=>{if(e.matches){playing=false;sync();}},options);
  wave?.addEventListener('click',()=>{try {waving=!waving;player.setInput('isWaving',waving);renderer.draw(player.advance(0),player.artboard.id);wave.setAttribute('aria-pressed',String(waving));wave.firstChild.textContent=waving?'Back to idle ':'Say hello ';state.textContent=waving?'Hello':'Idle';}catch{fail();}},options);
  function interact(operation) {try{operation();draw();}catch{fail();}}
  expression?.addEventListener('change',()=>interact(()=>player.setInput('expression',Number(expression.value))),options);
  characterReset?.addEventListener('click',()=>interact(()=>{player.reset();expression.value='0';playing=false;sync();}),options);
  blendInput?.addEventListener('input',()=>interact(()=>player.setInput('position',Number(blendInput.value))),options);
  blendOn?.addEventListener('change',()=>interact(()=>player.setInput('active',blendOn.checked)),options);
  enabled?.addEventListener('change',()=>interact(()=>player.setInput('enabled',enabled.checked)),options);
  level?.addEventListener('input',()=>interact(()=>{player.setInput('level',Number(level.value));element.querySelector('.level-value').textContent=level.value;}),options);
  celebrate?.addEventListener('click',()=>interact(()=>player.click('signal-celebration-pad')),options);
  reset?.addEventListener('click',()=>interact(()=>{player.reset();enabled.checked=false;level.value='0';element.querySelector('.level-value').textContent='0';}),options);
  function resetRideControls(){throttle.value='0';element.querySelector('.throttle-value').textContent='0%';brake.setAttribute('aria-pressed','false');headlight.checked=false;roughRoad.checked=true;playing=false;sync();}
  throttle?.addEventListener('input',()=>interact(()=>{player.setThrottle(Number(throttle.value)/100);element.querySelector('.throttle-value').textContent=throttle.value+'%';}),options);
  brake?.addEventListener('click',()=>interact(()=>{const value=brake.getAttribute('aria-pressed')!=='true';player.setBrake(value);brake.setAttribute('aria-pressed',String(value));}),options);
  bump?.addEventListener('click',()=>interact(()=>{message.textContent=player.bump()?'Suspension bump started. Play the ride to see it settle.':'Let the suspension settle before adding another bump.';}),options);
  turnSignal?.addEventListener('click',()=>interact(()=>{message.textContent=player.signal()?'Turn signal started: three blinks while the ride plays.':'The turn signal is still blinking.';}),options);
  headlight?.addEventListener('change',()=>interact(()=>player.setHeadlight(headlight.checked)),options);
  roughRoad?.addEventListener('change',()=>interact(()=>player.setRoughRoad(roughRoad.checked)),options);
  rideReset?.addEventListener('click',()=>interact(()=>{player.reset();message.textContent='Ride reset. Set throttle and start when you’re ready.';resetRideControls();}),options);
  retry.addEventListener('click',load,options);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&!started)load();sync();},{threshold:.05});observer.observe(element);
  document.addEventListener('visibilitychange',sync,options);
  window.addEventListener('pagehide',e=>{suspended=true;loop.stop();if(!e.persisted){attempt?.abort();observer.disconnect();lifetime.abort();player=null;renderer?.dispose();renderer=null;}},options);
  window.addEventListener('pageshow',e=>{if(e.persisted){suspended=false;sync();}},options);
}
for(const element of document.querySelectorAll('[data-preview]'))mountPreview(element);
