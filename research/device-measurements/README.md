# Physical-device measurement protocol

The cloud results use SwiftShader. They are not physical GPU or mobile measurements. The CDP transport has a passing local smoke test, which is not a mobile validation.

For a hardware desktop, install pinned dependencies (`npm ci`), set `CHROMIUM_PATH` if needed, copy `profile.example.json` outside the checkout, and fill in every field. Use real device information; the runner rejects placeholders. Set `EVIR_DEVICE_PROFILE` to that JSON and run `npm run benchmark:hardware`. It refuses a software/unidentified renderer before measurements and keeps cloud results separate. A non-software renderer plus operator provenance still does not constitute independent attestation of a physical device.

For an attached Android device, enable the device's standard debugging connection and Chrome remote debugging, confirm it is listed by `adb devices`, then run these commands on the machine running this checkout:

```bash
adb forward tcp:9222 localabstract:chrome_devtools_remote
adb reverse tcp:8776 tcp:8776
EVIR_CDP_URL=http://127.0.0.1:9222 EVIR_DEVICE_PROFILE=/path/to/device.json npm run benchmark:hardware
```

Keep Chrome in the foreground, with the screen on. The runner creates a new page in the existing remote browser context, uses the actual device viewport and pixel ratio, and closes that page/disconnects afterward. It does not launch a device-emulation profile or close the operator's other pages. The standard Android transport requires a connected device and ADB; neither is currently available in this workspace. iOS requires a separate supported device/browser driver and is not claimed by this Android path.

Run at least three independent trials on one hardware desktop and one physical Android device. Save each output in this directory as `desktop-1.json`, `desktop-2.json`, `desktop-3.json`, and `android-1.json` through `android-3.json`, using `EVIR_BENCHMARK_OUTPUT` to select each path. Record conditions, power mode, device/browser/driver versions and display refresh rate. Repeat when outliers or throttling require diagnosis. Run the baseline scenes and the added weighted mesh/data-binding/timed-transition scenarios; set `EVIR_BENCHMARK_FIXTURES` to select the latter.

Callback durations measure advance and CPU submission, not GPU completion. Scheduler cadence can track display refresh even while frames are skipped. JS heap, WASM capacity and process RSS describe different, overlapping scopes; do not sum them. The remote runner leaves host CPU/RAM and device RSS unavailable rather than reading the controller machine's `/proc` as though it were Android memory. Device-native RSS, GPU duration and GPU memory need additional platform instrumentation and remain unmeasured.

`tools/closure_report.py` keeps the physical-measurement item open until actual desktop and mobile results exist. A missing run cannot be filled with a local smoke test, device emulation, or a renamed cloud file.
