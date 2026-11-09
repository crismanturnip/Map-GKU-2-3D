import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

const browserPath = process.env.CHROME_PATH ?? (
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "google-chrome"
);
const siteUrl = process.env.SITE_URL ?? "http://127.0.0.1:5173/";
const profile = mkdtempSync(join(tmpdir(), "kexpo-cdp-"));
const browser = spawn(browserPath, [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-gpu-sandbox",
  "--use-angle=swiftshader",
  "--enable-webgl",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--window-size=1440,1000",
  siteUrl,
], { stdio: "ignore" });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDebugPort() {
  const portFile = join(profile, "DevToolsActivePort");
  for (let index = 0; index < 100; index++) {
    if (existsSync(portFile)) {
      return Number(readFileSync(portFile, "utf8").split("\n")[0]);
    }
    await delay(100);
  }
  throw new Error("Chrome remote debugging did not start");
}

async function main() {
  const port = await getDebugPort();
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = pages.find((item) => item.type === "page" && item.url.startsWith(siteUrl));
  if (!page) throw new Error("Preview page not found in Chrome");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const exceptions = [];
  const consoleErrors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.text);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map((argument) => argument.value ?? argument.description).join(" "));
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  };

  // Wait for React effects and the following WebGL frame, including when software
  // rendering takes longer than a fixed wall-clock delay in headless Chrome.
  const waitForPaint = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");

  await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  for (let index = 0; index < 50; index++) {
    if (await evaluate("Boolean(document.querySelector('canvas'))")) break;
    await delay(100);
  }
  await delay(1500);

  const initial = await evaluate("document.querySelector('.selection-pill')?.textContent?.trim()");
  if (initial !== "Belum ada objek dipilih") throw new Error(`Unexpected initial status: ${initial}`);

  const click = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await delay(80);
    return evaluate("document.querySelector('.selection-pill')?.textContent?.trim()");
  };

  const layout = await evaluate(`(async () => {
    const config = await import('/src/config/mapConfig.ts');
    return {
      stands: config.stands.length,
      buildings: config.buildings.length,
      stages: config.siteLayout.stages.length,
      stagePosition: config.siteLayout.stages[0].position,
      roads: config.siteLayout.roads,
      dualRoads: config.siteLayout.dualRoads,
      sentraGate: config.siteLayout.sentraGate,
      roundabout: config.siteLayout.roundabout,
      groundWidth: config.mapBounds.width,
      parking: config.siteLayout.parking,
      plaza: config.siteLayout.gku2.plaza,
      gridCellSize: config.gridCellSize,
      groundDepth: config.mapBounds.depth,
      gku2Rotation: config.siteLayout.gku2.rotation,
      gku2Position: config.siteLayout.gku2.position,
      rearExtension: config.siteLayout.gku2.rearExtension,
      wings: config.siteLayout.gku2.wings.map((wing) => ({ id: wing.id, depth: wing.z[1] - wing.z[0] })),
      zones: config.zones.map((zone) => ({ name: zone.name, stands: zone.standIds.length, points: zone.points, minX: zone.position[0] + Math.min(...zone.points.map((point) => point[0])), maxX: zone.position[0] + Math.max(...zone.points.map((point) => point[0])), minZ: zone.position[1] + Math.min(...zone.points.map((point) => point[1])), maxZ: zone.position[1] + Math.max(...zone.points.map((point) => point[1])) }))
    };
  })()`);
  if (layout.stands !== 0 || layout.buildings !== 0 || layout.stages !== 1 || layout.zones.length !== 4 || layout.zones.some((zone) => zone.stands !== 0)) {
    throw new Error(`Unexpected revised layout: ${JSON.stringify(layout)}`);
  }
  const green = layout.zones.find((zone) => zone.name === "Zone A");
  const orange = layout.zones.find((zone) => zone.name === "Zone C");
  const roofOverhang = 0.12;
  if (layout.gku2Rotation !== 0 || !green || !orange || green.maxX >= layout.gku2Position[0] - 18 - roofOverhang || orange.minX <= layout.gku2Position[0] + 18 + roofOverhang) {
    throw new Error(`Building and adjacent areas are not aligned: ${JSON.stringify(layout)}`);
  }
  if (orange.points.length !== 4 || new Set(orange.points.map((point) => point[0])).size !== 2 || new Set(orange.points.map((point) => point[1])).size !== 2) {
    throw new Error(`Orange area is not rectangular: ${JSON.stringify(orange.points)}`);
  }
  if (Math.abs((orange.maxX - orange.minX) - (green.maxX - green.minX)) > 0.0001) {
    throw new Error(`Orange and green area widths differ: ${JSON.stringify({ green, orange })}`);
  }
  const expectedRear = layout.gku2Position[1] + 20 + layout.rearExtension;
  if (layout.rearExtension !== 4 * layout.gridCellSize || green.maxZ !== expectedRear || orange.maxZ !== expectedRear || layout.stagePosition[1] !== 30 + layout.rearExtension || layout.stagePosition[1] + 3.5 > layout.groundDepth / 2) {
    throw new Error(`Extension or stage position is incorrect: ${JSON.stringify(layout)}`);
  }
  const newBranch = layout.roads.find((road) => road.id === "entrance-branch");
  const front = layout.dualRoads.roads.find((road) => road.id === "front");
  const westSide = layout.dualRoads.roads.find((road) => road.id === "west-side");
  const { laneWidth, medianWidth } = layout.dualRoads;
  const halfRoadWidth = medianWidth / 2 + laneWidth;
  const { roundabout } = layout;
  const plazaFront = layout.gku2Position[1] + layout.plaza.z[0];
  const plazaBounds = {
    minX: layout.gku2Position[0] + layout.plaza.x[0],
    maxX: layout.gku2Position[0] + layout.plaza.x[1],
    minZ: plazaFront,
    maxZ: layout.gku2Position[1] + layout.plaza.z[1],
  };
  const branchStart = newBranch && newBranch.position[1] - newBranch.size[1] / 2;
  const branchEnd = newBranch && newBranch.position[1] + newBranch.size[1] / 2;
  if (
    layout.roads.length !== 1 || layout.parking !== undefined || !newBranch || !front || !westSide
    || front.axis !== "x" || westSide.axis !== "z"
    || front.offset !== roundabout.position[1] || front.to !== roundabout.position[0] || front.from !== -layout.groundWidth / 2
    || westSide.offset !== roundabout.position[0] || westSide.from !== -layout.groundDepth / 2 || westSide.to !== layout.groundDepth / 2
    || westSide.offset - halfRoadWidth <= plazaBounds.maxX
    || roundabout.radius <= halfRoadWidth || roundabout.position[0] + roundabout.radius > layout.groundWidth / 2
    || branchStart !== front.offset + halfRoadWidth || branchEnd <= plazaFront
    || layout.sentraGate[0] !== newBranch.position[0] || layout.sentraGate[1] <= branchStart || layout.sentraGate[1] >= plazaFront
  ) {
    throw new Error(`Roads or roundabout are misplaced: ${JSON.stringify({ roads: layout.roads, dualRoads: layout.dualRoads, roundabout, plazaBounds })}`);
  }
  if (layout.zones.some((zone) => zone.minX < plazaBounds.minX || zone.maxX > plazaBounds.maxX || zone.minZ < plazaBounds.minZ || zone.maxZ > plazaBounds.maxZ) || layout.stagePosition[1] + 3.5 > plazaBounds.maxZ) {
    throw new Error(`Plaza does not cover the areas and stage: ${JSON.stringify({ plazaBounds, zones: layout.zones })}`);
  }

  const sceneDetails = await evaluate(`(async () => {
    const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('@react-three_fiber.js'));
    const { _roots } = await import(resource.name);
    const scene = _roots.get(document.querySelector('canvas')).store.getState().scene;
    const areaIds = ['zone-a', 'zone-b', 'zone-c', 'zone-e'];
    return {
      areas: areaIds.map((id) => {
        const mesh = scene.getObjectByName('area-' + id);
        return { id, opacity: mesh?.material.opacity, transparent: mesh?.material.transparent, receiveShadow: mesh?.receiveShadow };
      }),
      wings: ${JSON.stringify(layout.wings.map((wing) => wing.id))}.map((name) => {
        const group = scene.getObjectByName(name);
        return { name, depth: group?.children[0]?.geometry.parameters.depth };
      })
    };
  })()`);
  if (sceneDetails.areas.some((area) => area.opacity !== 1 || area.transparent || area.receiveShadow) || sceneDetails.wings.some((wing, index) => wing.depth !== layout.wings[index].depth)) {
    throw new Error(`Area opacity or building dimensions are incorrect: ${JSON.stringify(sceneDetails)}`);
  }

  const projectPoint = (x, z) => evaluate(`(async () => {
    const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('@react-three_fiber.js'));
    const { _roots } = await import(resource.name);
    const canvas = document.querySelector('canvas');
    const camera = _roots.get(canvas).store.getState().camera;
    const point = camera.position.clone().set(${x}, 0.23, ${z}).project(camera);
    const bounds = canvas.getBoundingClientRect();
    return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 };
  })()`);
  const areaChecks = [
    { name: "Zone A", position: [-27, 6] },
    { name: "Zone C", position: [34, 5] },
    { name: "Area Photobooth", position: [35, -21] },
    { name: "Area Sponsor", position: [15, -21.5] },
  ];
  const panelState = () => evaluate(`(() => {
    const panel = document.querySelector('.zone-panel');
    return panel ? {
      title: panel.querySelector('h2')?.textContent?.trim(),
      items: panel.querySelectorAll('.zone-panel__list li').length,
      focused: document.activeElement === panel.querySelector('.zone-panel__close'),
    } : null;
  })()`);
  const focusState = () => evaluate(`(async () => {
    const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('@react-three_fiber.js'));
    const { _roots } = await import(resource.name);
    const state = _roots.get(document.querySelector('canvas')).store.getState();
    return { position: state.camera.position.toArray(), target: state.controls.target.toArray(), distance: state.controls.getDistance() };
  })()`);
  const zoneCenters = Object.fromEntries(layout.zones.map((zone) => [zone.name, [(zone.minX + zone.maxX) / 2, (zone.minZ + zone.maxZ) / 2]]));
  for (const [index, area] of areaChecks.entries()) {
    const before = await focusState();
    const point = await projectPoint(...area.position);
    const status = await click(point.x, point.y);
    if (status !== area.name) throw new Error(`Area ${area.name} did not select: ${status}`);
    // Uji berjalan dengan prefers-reduced-motion, jadi kamera langsung berpindah tanpa animasi.
    await delay(400);
    await waitForPaint();
    const zoomed = await focusState();
    const [centerX, centerZ] = zoneCenters[area.name];
    if (zoomed.distance >= before.distance * 0.9 || Math.hypot(zoomed.target[0] - centerX, zoomed.target[2] - centerZ) > 0.01) {
      throw new Error(`Camera did not zoom to ${area.name}: ${JSON.stringify({ before, zoomed, center: [centerX, centerZ] })}`);
    }
    const panel = await panelState();
    if (!panel || panel.title !== area.name || panel.items === 0 || !panel.focused) {
      throw new Error(`Zone info panel is incorrect for ${area.name}: ${JSON.stringify(panel)}`);
    }
    // Tutup bergantian lewat tombol dan Escape agar panel tidak menutupi titik klik area berikutnya.
    if (index % 2 === 0) {
      await evaluate("document.querySelector('.zone-panel__close').click()");
    } else {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    }
    await delay(400);
    await waitForPaint();
    const restored = await focusState();
    if (restored.position.some((value, axis) => Math.abs(value - before.position[axis]) > 0.01) || restored.target.some((value) => Math.abs(value) > 0.01)) {
      throw new Error(`Camera did not zoom back out after ${area.name}: ${JSON.stringify({ before, restored })}`);
    }
    const afterClose = await evaluate("document.querySelector('.selection-pill')?.textContent?.trim()");
    if ((await panelState()) !== null || afterClose !== "Belum ada objek dipilih") {
      throw new Error(`Zone info panel did not close for ${area.name}: ${afterClose}`);
    }
  }
  console.log(`Areas selectable with info panel and camera focus: ${areaChecks.map((area) => area.name).join(', ')}`);

  const cameraState = () => evaluate(`(async () => {
    const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('@react-three_fiber.js'));
    if (!resource) throw new Error('React Three Fiber module was not found');
    const { _roots } = await import(resource.name);
    const state = _roots.get(document.querySelector('canvas'))?.store.getState();
    if (!state?.controls) throw new Error('Camera controls are not ready');
    const controls = state.controls;
    return {
      azimuth: controls.getAzimuthalAngle(),
      polar: controls.getPolarAngle(),
      distance: controls.getDistance(),
      position: state.camera.position.toArray(),
      target: controls.target.toArray(),
      autoRotate: controls.autoRotate,
      enablePan: controls.enablePan,
      enableZoom: controls.enableZoom,
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
      azimuthUnbounded: !Number.isFinite(controls.minAzimuthAngle) && !Number.isFinite(controls.maxAzimuthAngle)
    };
  })()`);

  const drag = async (button, x1, y1, x2, y2) => {
    const buttons = button === "left" ? 1 : 2;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x1, y: y1, button, buttons, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x2, y: y2, button, buttons });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button, buttons: 0, clickCount: 1 });
    await delay(900);
    await waitForPaint();
  };

  if (process.env.QA_TOP_SCREENSHOT) {
    const screenshotCamera = (process.env.QA_TOP_CAMERA ?? "0,145,-37").split(",").map(Number);
    if (screenshotCamera.length !== 3 || screenshotCamera.some((value) => !Number.isFinite(value))) {
      throw new Error("QA_TOP_CAMERA must contain three numeric coordinates");
    }
    await send("Emulation.setDeviceMetricsOverride", { width: 922, height: 712, deviceScaleFactor: 1, mobile: false });
    await delay(300);
    await evaluate(`(async () => {
      const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('@react-three_fiber.js'));
      const { _roots } = await import(resource.name);
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const controls = state.controls;
      controls.enableDamping = false;
      controls.autoRotate = false;
      controls.update();
      state.camera.position.set(${screenshotCamera.join(", ")});
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enableDamping = true;
    })()`);
    await delay(700);
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(process.env.QA_TOP_SCREENSHOT, Buffer.from(screenshot.data, "base64"));
    await send("Emulation.clearDeviceMetricsOverride");
    await delay(300);
  }

  await evaluate("document.querySelector('.reset-button').click()");
  await delay(300);
  await waitForPaint();
  const home = await cameraState();
  if (home.enablePan || !home.enableZoom || !home.azimuthUnbounded || home.minDistance !== 55 || home.maxDistance !== 300) {
    throw new Error(`Unexpected camera configuration: ${JSON.stringify(home)}`);
  }

  let previousAngle = home.azimuth;
  let totalRotation = 0;
  for (let index = 0; index < 8 && Math.abs(totalRotation) < Math.PI * 2; index++) {
    await drag("left", 450, 500, 800, 500);
    const currentAngle = (await cameraState()).azimuth;
    totalRotation += Math.atan2(Math.sin(currentAngle - previousAngle), Math.cos(currentAngle - previousAngle));
    previousAngle = currentAngle;
  }
  if (Math.abs(totalRotation) < Math.PI * 2) {
    throw new Error(`Horizontal rotation did not exceed 360°: ${totalRotation} radians`);
  }

  await drag("left", 700, 200, 700, 820);
  const tilted = await cameraState();
  let lowered = tilted;
  for (let index = 0; index < 4 && lowered.polar < 1.49; index++) {
    await drag("left", 700, 820, 700, 200);
    lowered = await cameraState();
  }
  if (tilted.polar < 0.25 - 0.001 || lowered.polar > 1.5 + 0.001 || lowered.polar < 1.49) {
    throw new Error(`Vertical rotation exceeded its limits: ${tilted.polar}, ${lowered.polar}`);
  }

  await drag("right", 650, 500, 800, 540);
  const afterRightDrag = await cameraState();
  if (afterRightDrag.target.some((value, index) => Math.abs(value - home.target[index]) > 0.0001)) {
    throw new Error("Right drag moved the orbit target while pan is disabled");
  }
  await send("Input.dispatchMouseEvent", {
    type: "mouseWheel", x: 700, y: 500, deltaX: 0, deltaY: -360,
  });
  await delay(300);
  const afterWheel = await cameraState();
  if (afterWheel.distance >= afterRightDrag.distance - 0.01) throw new Error("Mouse wheel did not zoom in");

  await evaluate("document.querySelector('.reset-button').click()");
  await delay(300);
  const reset = await cameraState();
  if (reset.position.some((value, index) => Math.abs(value - home.position[index]) > 0.001)) {
    throw new Error(`Reset did not restore the home position: ${JSON.stringify({ home, reset })}`);
  }

  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await drag("left", 650, 500, 730, 500);
  await delay(1700);
  if ((await cameraState()).autoRotate) throw new Error("Auto-rotation resumed before the four-second delay");
  await delay(1900);
  if (!(await cameraState()).autoRotate) throw new Error("Auto-rotation did not resume after the four-second delay");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

  await send("Emulation.setDeviceMetricsOverride", {
    width: 412,
    height: 915,
    deviceScaleFactor: 1,
    mobile: true,
  });
  for (let index = 0; index < 50; index++) {
    const canvasWidth = await evaluate("document.querySelector('canvas')?.getBoundingClientRect().width ?? 0");
    if (canvasWidth === 412) break;
    await delay(100);
  }
  await delay(300);
  const mobile = await evaluate(`(() => {
    const button = document.querySelector('.reset-button').getBoundingClientRect();
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    return {
      width: innerWidth,
      buttonVisible: button.left >= 0 && button.right <= innerWidth,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
  })()`);
  if (mobile.width !== 412 || !mobile.buttonVisible || mobile.canvasWidth !== 412) {
    throw new Error(`Mobile viewport check failed: ${JSON.stringify(mobile)}`);
  }

  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const mobileBeforeGesture = await cameraState();
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 190, y: 460, id: 1 }] });
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 240, y: 500, id: 1 }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(900);
  const mobileAfterRotate = await cameraState();
  if (Math.abs(mobileAfterRotate.azimuth - mobileBeforeGesture.azimuth) < 0.01) {
    throw new Error("Mobile one-finger drag did not rotate the camera");
  }

  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 170, y: 460, id: 1 }, { x: 230, y: 460, id: 2 }],
  });
  await send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 150, y: 460, id: 1 }, { x: 250, y: 460, id: 2 }],
  });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(300);
  const mobileAfterPinch = await cameraState();
  if (mobileAfterPinch.distance >= mobileAfterRotate.distance - 0.01) {
    throw new Error("Mobile spread gesture did not zoom in");
  }

  const pinch = async (startGap, endGap) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 206 - startGap / 2, y: 460, id: 1 }, { x: 206 + startGap / 2, y: 460, id: 2 }] });
    await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 206 - endGap / 2, y: 460, id: 1 }, { x: 206 + endGap / 2, y: 460, id: 2 }] });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await waitForPaint();
  };
  await pinch(160, 80);
  const mobileZoomedOut = await cameraState();
  if (mobileZoomedOut.distance <= mobileAfterPinch.distance + 0.01) throw new Error("Mobile pinch did not zoom out");
  for (let index = 0; index < 4; index++) await pinch(24, 360);
  const nearest = await cameraState();
  if (Math.abs(nearest.distance - nearest.minDistance) > 0.01) throw new Error(`Zoom-in limit failed: ${nearest.distance}`);
  for (let index = 0; index < 4; index++) await pinch(360, 24);
  const farthest = await cameraState();
  if (Math.abs(farthest.distance - farthest.maxDistance) > 0.01) throw new Error(`Zoom-out limit failed: ${farthest.distance}`);
  await evaluate("document.querySelector('.reset-button').click()");
  await waitForPaint();
  const mobileReset = await cameraState();
  if (Math.abs(mobileReset.distance - mobileBeforeGesture.distance) > 0.01) throw new Error("Mobile reset did not restore initial zoom");
  console.log(JSON.stringify({ areas: areaChecks.map((area) => area.name), layout, sceneDetails, horizontalRotationDegrees: Math.round(Math.abs(totalRotation) * 180 / Math.PI), verticalPolarRadians: [tilted.polar, lowered.polar], disabledControls: "pan", zoom: { desktop: "mouse wheel", min: nearest.distance, max: farthest.distance }, reset: "home position and zoom restored", autoRotate: "resumed after four seconds", mobile: { ...mobile, gestures: "one-finger orbit; two-finger zoom in and out", zoomDistances: [mobileAfterRotate.distance, mobileAfterPinch.distance, mobileZoomedOut.distance] }, exceptions, consoleErrors }, null, 2));
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join("; ")}`);
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join("; ")}`);
  socket.close();
}

try {
  await main();
} finally {
  browser.kill();
  await delay(250);
  const tempRoot = resolve(tmpdir());
  const profilePath = resolve(profile);
  if (profilePath.startsWith(`${tempRoot}${sep}`) && basename(profilePath).startsWith("kexpo-cdp-")) {
    // Chrome kadang masih mengunci profil sesaat; jangan sampai menutupi hasil uji.
    try {
      rmSync(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      console.warn(`Profile cleanup skipped: ${error.message}`);
    }
  }
}
