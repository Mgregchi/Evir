// Loaded only when a creator explicitly views an original .riv file.
import {Rive,RuntimeLoader,Layout,Fit,Alignment,StateMachineInputType} from '@rive-app/canvas';
export function configureRuntime(baseUrl){
  RuntimeLoader.setWasmUrl(new URL('assets/rive-view.wasm',baseUrl).href);
  RuntimeLoader.setWasmFallbackUrl(new URL('assets/rive-view-fallback.wasm',baseUrl).href);
  return {Rive,Layout,Fit,Alignment,StateMachineInputType};
}
