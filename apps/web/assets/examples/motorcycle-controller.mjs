import {AnimationMixer} from '@evir/runtime';

export const motorcycleLayers = ['wheels','asphalt','distance','passing','roadside','bump','sunlight','light','brake','indicator'].map(id=>`motorcycle-${id}`);
// This is an example host controller, not a general vehicle-physics engine.
export class MotorcycleController {
  constructor(project) {
    this.mixer=new AnimationMixer(project,{layers:motorcycleLayers.map(animationId=>({animationId,speed:['motorcycle-sunlight','motorcycle-bump','motorcycle-indicator'].includes(animationId)?1:0,enabled:!['motorcycle-light','motorcycle-brake','motorcycle-indicator'].includes(animationId)}))});
    this.reset();
  }
  get artboard(){return this.mixer.artboard;}
  get telemetry(){return {speed:this.speed,speedKmh:this.speed*3.6,distance:this.distance,throttle:this.throttle,braking:this.braking,headlight:this.headlight,roughRoad:this.roughRoad,bumpCount:this.bumpCount};}
  setThrottle(value){if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Throttle must be 0–1');this.throttle=value;}
  setBrake(value){if(typeof value!=='boolean')throw new TypeError('Brake must be boolean');this.braking=value;this.mixer.setEnabled('motorcycle-brake',value);}
  setHeadlight(value){if(typeof value!=='boolean')throw new TypeError('Headlight must be boolean');this.headlight=value;this.mixer.setEnabled('motorcycle-light',value);}
  setRoughRoad(value){if(typeof value!=='boolean')throw new TypeError('Road setting must be boolean');this.roughRoad=value;this.nextBump=this.distance+18;}
  bump(){if(!this.mixer.playback('motorcycle-bump').completed&&this.bumpCount>0)return false;this.mixer.restart('motorcycle-bump');this.bumpCount++;return true;}
  signal(){const state=this.mixer.playback('motorcycle-indicator');if(state.enabled&&!state.completed)return false;this.mixer.restart('motorcycle-indicator');return true;}
  advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0||seconds>60)throw new RangeError('Vehicle delta must be 0–60 seconds');
    // Small substeps keep acceleration/braking stable across display rates.
    const steps=Math.max(1,Math.ceil(seconds*120)),dt=seconds/steps;
    for(let i=0;i<steps;i++){
      const acceleration=this.braking?-9:this.throttle*5-.35-.018*this.speed*this.speed;
      const previous=this.speed;this.speed=Math.max(0,Math.min(22,this.speed+acceleration*dt));
      const mean=(previous+this.speed)/2;this.distance+=mean*dt;
      this.mixer.setSpeed('motorcycle-wheels',mean/(2*Math.PI*.34));
      const pixelsPerMetre=43/.34;
      this.mixer.setSpeed('motorcycle-asphalt',mean/(128/pixelsPerMetre));
      this.mixer.setSpeed('motorcycle-roadside',mean/(128/(pixelsPerMetre*1.35)));
      this.mixer.setSpeed('motorcycle-distance',mean/25.6);
      this.mixer.setSpeed('motorcycle-passing',mean/12.8);
      this.mixer.advanceClocks(dt);
      if(this.roughRoad&&this.distance>=this.nextBump){this.bump();this.nextBump=this.distance+18;}
    }
    return this.pose();
  }
  pose(){return this.mixer.pose();}
  reset(){
    this.speed=0;this.distance=0;this.throttle=0;this.braking=false;this.headlight=false;this.roughRoad=true;this.nextBump=18;this.bumpCount=0;
    this.mixer.reset();this.mixer.seek('motorcycle-bump',48);
    for(const id of motorcycleLayers)this.mixer.setSpeed(id,['motorcycle-sunlight','motorcycle-bump','motorcycle-indicator'].includes(id)?1:0);
    this.mixer.setEnabled('motorcycle-light',false);this.mixer.setEnabled('motorcycle-brake',false);
    this.mixer.setEnabled('motorcycle-indicator',false);
    return this.pose();
  }
}
