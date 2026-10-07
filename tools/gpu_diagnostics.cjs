// Observe the actual contexts used by the runtime, rather than a separate probe canvas.
exports.install = async (page) => {
  await page.addInitScript(() => {
    window.evirContexts = [];
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const gl = get.call(this, type, ...args);
      if (type === "webgl2" && gl && !evirContexts.includes(gl))
        evirContexts.push(gl);
      return gl;
    };
  });
};

exports.collect = (page) =>
  page.evaluate(() => ({
    browser: navigator.userAgent,
    contexts: (window.evirContexts || []).map((gl) => {
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const errors = [];
      for (let i = 0; i < 16; i++) {
        const code = gl.getError();
        if (code === gl.NO_ERROR) break;
        errors.push(code);
      }
      return {
        version: gl.getParameter(gl.VERSION),
        renderer: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        unmaskedRendererAvailable: !!debug,
        contextLost: gl.isContextLost(),
        errors,
        extensions: gl.getSupportedExtensions(),
      };
    }),
  }));

exports.requireHardware = (diagnostics) => {
  if (!diagnostics.contexts.length)
    throw Error("No runtime WebGL2 context observed");
  for (const context of diagnostics.contexts) {
    if (context.contextLost || context.errors.length)
      throw Error("WebGL context is unhealthy");
    if (!context.unmaskedRendererAvailable)
      throw Error("Hardware renderer cannot be identified");
    if (/swiftshader|llvmpipe|softpipe|software|swrast/i.test(context.renderer))
      throw Error("Hardware measurement unavailable: " + context.renderer);
  }
  // A non-software renderer still needs physical-device provenance from the operator.
};
