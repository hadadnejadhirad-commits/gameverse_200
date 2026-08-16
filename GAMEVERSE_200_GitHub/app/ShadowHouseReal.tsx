"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_TYPES from "three";

type Lang = "fa" | "en";
type Phase = "intro" | "film" | "playing" | "lost" | "won";
type Box = { minX: number; maxX: number; minZ: number; maxZ: number; level: number };
type Best = { name: string; time: number };

const ui = {
  fa: {
    newGame: "بازی جدید",
    title: "پروتکل زیرزمین",
    intro: "یک تجربهٔ سه‌بعدی واقعی‌تر با زیرزمین، آسانسور، انبار، اتاق ژنراتور و نقشه‌ای که در هر عملیات تغییر می‌کند.",
    watch: "▶ تماشای فیلم و شروع",
    skip: "رد کردن فیلم",
    keys: "کلیدها",
    floor: "طبقه",
    ground: "همکف",
    basement: "زیرزمین",
    elevator: "برای استفاده از آسانسور F را بزن",
    mission: "سه کارت دسترسی را پیدا کن و در خروج زیرزمین را باز کن.",
    found: "کارت دسترسی پیدا شد.",
    won: "سیگنال متوقف شد؛ مأموریت موفق بود!",
    lost: "نگهبان پیدایت کرد؛ دوباره تلاش کن.",
    retry: "شروع عملیات تازه",
    fullscreen: "⛶ بزرگ‌نمایی",
    shrink: "کوچک‌نمایی",
    controls: "WASD حرکت • Q/E یا ←/→ چرخش • F آسانسور",
    leader: "♛ نفر برتر",
    noRecord: "هنوز رکوردی ثبت نشده",
    time: "زمان",
    seconds: "ثانیه",
    musicOn: "♫ موسیقی روشن",
    musicOff: "♫ موسیقی خاموش",
    soundHint: "برای شنیدن صدا کلیک کن",
    loading: "در حال آماده‌سازی موتور سه‌بعدی…",
    error: "موتور سه‌بعدی در این مرورگر اجرا نشد. صفحه را تازه‌سازی کن یا شتاب‌دهی سخت‌افزاری مرورگر را فعال کن.",
    scenes: [
      ["قطع ارتباط", "ایستگاه زیرزمینی شهر پس از دریافت یک سیگنال ناشناس از شبکه خارج شده است."],
      ["مأمور ریون", "سرباز ریون-۷ برای پیدا کردن سه کارت دسترسی و رسیدن به اتاق کنترل اعزام می‌شود."],
      ["هدف نهایی", "آسانسور را فعال کن، زیرزمین را جست‌وجو کن و پیش از رسیدن نگهبان، در خروج را باز کن."],
    ],
  },
  en: {
    newGame: "NEW GAME",
    title: "Basement Protocol",
    intro: "A richer 3D mission with a basement, working elevator, storage rooms, generator room, and a layout that changes every run.",
    watch: "▶ Watch film & deploy",
    skip: "Skip film",
    keys: "Keys",
    floor: "Floor",
    ground: "Ground",
    basement: "Basement",
    elevator: "Press F to use the elevator",
    mission: "Find three access cards and unlock the basement exit.",
    found: "Access card recovered.",
    won: "Signal stopped. Mission complete!",
    lost: "The guardian found you. Try again.",
    retry: "Start a new mission",
    fullscreen: "⛶ Fullscreen",
    shrink: "Exit fullscreen",
    controls: "WASD move • Q/E or ←/→ turn • F elevator",
    leader: "♛ TOP PLAYER",
    noRecord: "No record yet",
    time: "Time",
    seconds: "seconds",
    musicOn: "♫ Music on",
    musicOff: "♫ Music off",
    soundHint: "Click to hear sound",
    loading: "Preparing the 3D engine…",
    error: "The 3D engine could not start in this browser. Refresh the page or enable browser hardware acceleration.",
    scenes: [
      ["CONNECTION LOST", "The city's underground relay went dark after receiving an unidentified signal."],
      ["AGENT RAVEN", "Soldier Raven-7 is sent in to recover three access cards and reach the control room."],
      ["FINAL OBJECTIVE", "Activate the elevator, search the basement, and unlock the exit before the guardian arrives."],
    ],
  },
};

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export default function ShadowHouseReal({ lang, playerName = "Raven-7" }: { lang: Lang; playerName?: string }) {
  const t = ui[lang];
  const mountRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const gameRef = useRef<{ start: () => void } | null>(null);
  const startQueuedRef = useRef(false);
  const bestRef = useRef<Best | null>(null);
  const musicRef = useRef<{ ctx: AudioContext; master: GainNode; nodes: OscillatorNode[] } | null>(null);
  const soundtrackRef = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [filmStep, setFilmStep] = useState(0);
  const [found, setFound] = useState(0);
  const [floor, setFloor] = useState<0 | 1>(0);
  const [note, setNote] = useState(t.mission);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [gameError, setGameError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<Best | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const startMusic = () => {
    const soundtrack = soundtrackRef.current;
    if (soundtrack) {
      soundtrack.muted = false;
      soundtrack.volume = .9;
      void soundtrack.play().then(() => setSoundOn(true)).catch(() => setSoundOn(false));
    }
    const current = musicRef.current;
    if (current) {
      void current.ctx.resume();
      current.master.gain.setTargetAtTime(.11, current.ctx.currentTime, .12);
      return;
    }
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = .11;
      master.connect(ctx.destination);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 210;
      filter.Q.value = 1.8;
      filter.connect(master);
      const nodes = [55, 82.4, 110].map((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = index === 1 ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index * -7;
        gain.gain.value = index === 0 ? .42 : .16;
        oscillator.connect(gain).connect(filter);
        oscillator.start();
        return oscillator;
      });
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = .075;
      lfoGain.gain.value = 90;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      nodes.push(lfo);
      musicRef.current = { ctx, master, nodes };
      void ctx.resume();
    } catch {}
  };

  const toggleMusic = () => {
    const current = musicRef.current;
    const soundtrack = soundtrackRef.current;
    if (!soundOn) { startMusic(); return; }
    soundtrack?.pause();
    if (current) current.master.gain.setTargetAtTime(0, current.ctx.currentTime, .16);
    setSoundOn(false);
  };

  const playTone = (frequency: number, duration = .16, level = .16) => {
    const current = musicRef.current;
    if (!current || current.ctx.state !== "running") return;
    const oscillator = current.ctx.createOscillator();
    const gain = current.ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(level, current.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, current.ctx.currentTime + duration);
    oscillator.connect(gain).connect(current.master);
    oscillator.start();
    oscillator.stop(current.ctx.currentTime + duration);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("basement-protocol-best");
      if (saved) { const parsed = JSON.parse(saved) as Best; bestRef.current = parsed; setBest(parsed); }
    } catch {}
    return () => {
      soundtrackRef.current?.pause();
      const music = musicRef.current;
      if (music) { music.nodes.forEach(node => node.stop()); void music.ctx.close(); musicRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = false);
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    if (phase !== "film") return;
    const timers = [
      window.setTimeout(() => setFilmStep(1), 2600),
      window.setTimeout(() => setFilmStep(2), 5200),
      window.setTimeout(() => {
        if (gameRef.current) gameRef.current.start();
        else startQueuedRef.current = true;
      }, 7900),
    ];
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [phase]);

  useEffect(() => {
    const externalStart = () => { startMusic(); setFilmStep(0); setPhase("film"); };
    addEventListener("start-shadow-house", externalStart);
    return () => removeEventListener("start-shadow-house", externalStart);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const shell = shellRef.current;
    const previous = document.body.style.overflow;
    shell?.classList.add("expanded");
    document.body.style.overflow = "hidden";
    return () => { shell?.classList.remove("expanded"); document.body.style.overflow = previous; };
  }, [expanded]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
    try {
    const THREE = await import("three");
    const mount = mountRef.current;
    if (!mount || disposed) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a);
    scene.fog = new THREE.FogExp2(0x05070a, 0.035);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 90);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0x9eb7cf, 0x101014, 0.28);
    scene.add(ambient);
    const flashlight = new THREE.SpotLight(0xf2f0d8, 28, 22, Math.PI / 7, 0.48, 1.35);
    flashlight.position.set(0.18, -0.12, -0.1);
    flashlight.target.position.set(0, -0.08, -8);
    flashlight.castShadow = true;
    camera.add(flashlight, flashlight.target);
    scene.add(camera);

    const arms = new THREE.Group();
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x28333b, roughness: 0.8, metalness: 0.08 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb88768, roughness: 0.75 });
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.42, 5, 10);
    const leftArm = new THREE.Mesh(armGeo, sleeve); leftArm.rotation.z = -0.5; leftArm.position.set(-0.26, -0.28, -0.55);
    const rightArm = leftArm.clone(); rightArm.rotation.z = 0.5; rightArm.position.x = 0.26;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), skin); hand.position.set(0.08, -0.42, -0.7);
    arms.add(leftArm, rightArm, hand); camera.add(arms);

    const root = new THREE.Group();
    scene.add(root);
    const colliders: Box[] = [];
    const pickables: Array<{ mesh: THREE_TYPES.Group; level: number; found: boolean }> = [];
    let exitDoor: THREE_TYPES.Mesh | null = null;
    let guardian: THREE_TYPES.Group | null = null;
    let running = false;
    let collected = 0;
    let currentFloor: 0 | 1 = 0;
    let lastElevator = 0;
    let startedAt = 0;
    let yaw = Math.PI;
    const player = new THREE.Vector3(0, 1.62, 11);

    const concrete = new THREE.MeshStandardMaterial({ color: 0x555a5e, roughness: 0.96, metalness: 0.03 });
    const basementConcrete = new THREE.MeshStandardMaterial({ color: 0x34393b, roughness: 1 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x24282b, roughness: 0.82, metalness: 0.16 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x717980, roughness: 0.38, metalness: 0.82 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x252a2e, roughness: 0.5, metalness: 0.7 });

    const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE_TYPES.Material, cast = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
      mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    const wall = (x: number, z: number, sx: number, sz: number, level: 0 | 1, material = concrete) => {
      const baseY = level === 0 ? 1.5 : -5.5;
      box(x, baseY, z, sx, 3, sz, material);
      colliders.push({ minX: x - sx / 2 - .25, maxX: x + sx / 2 + .25, minZ: z - sz / 2 - .25, maxZ: z + sz / 2 + .25, level });
    };
    const lamp = (x: number, z: number, level: 0 | 1, color = 0xc9dcff) => {
      const y = level === 0 ? 2.75 : -4.25;
      box(x, y, z, 1.3, .08, .18, new THREE.MeshBasicMaterial({ color }));
      const light = new THREE.PointLight(color, 4.2, 8, 2); light.position.set(x, y - .15, z); light.castShadow = true; root.add(light);
    };
    const propCrate = (x: number, z: number, level: 0 | 1) => {
      const y = level === 0 ? .45 : -6.55;
      const crate = box(x, y, z, .9, .9, .9, new THREE.MeshStandardMaterial({ color: 0x594638, roughness: .9 }));
      crate.rotation.y = Math.random() * Math.PI;
    };
    const pipe = (x: number, z: number, level: 0 | 1, length = 5) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, length, 12), metal);
      mesh.rotation.z = Math.PI / 2; mesh.position.set(x, level === 0 ? 2.25 : -4.75, z); mesh.castShadow = true; root.add(mesh);
    };

    const clearWorld = () => {
      while (root.children.length) root.remove(root.children[0]);
      colliders.length = 0; pickables.length = 0; exitDoor = null; guardian = null;
    };

    const buildWorld = () => {
      clearWorld();
      const rnd = seeded(Date.now() ^ Math.floor(Math.random() * 999999));
      box(0, -.08, 0, 28, .16, 28, floorMat, false);
      box(0, 3.05, 0, 28, .12, 28, darkMetal, false);
      box(0, -7.08, 0, 28, .16, 28, basementConcrete, false);
      box(0, -3.95, 0, 28, .12, 28, darkMetal, false);
      for (const level of [0, 1] as const) {
        wall(-14, 0, .5, 28, level, level ? basementConcrete : concrete);
        wall(14, 0, .5, 28, level, level ? basementConcrete : concrete);
        wall(0, -14, 28, .5, level, level ? basementConcrete : concrete);
        wall(0, 14, 28, .5, level, level ? basementConcrete : concrete);
        const shift = (rnd() - .5) * 3;
        wall(-4 + shift, -6, .45, 11, level, level ? basementConcrete : concrete);
        wall(5 - shift, 5, .45, 12, level, level ? basementConcrete : concrete);
        wall(-7, 4 + shift, 8, .45, level, level ? basementConcrete : concrete);
        wall(7, -3 - shift, 9, .45, level, level ? basementConcrete : concrete);
        lamp(-9, 8, level); lamp(7, 8, level, 0xffd7a3); lamp(8, -9, level); lamp(-8, -8, level, 0xffc4a4);
      }
      for (let i = 0; i < 18; i++) propCrate(-11 + rnd() * 22, -11 + rnd() * 22, rnd() > .48 ? 1 : 0);
      for (let i = 0; i < 8; i++) pipe(-9 + rnd() * 18, -10 + rnd() * 20, (i % 2) as 0 | 1, 3 + rnd() * 5);

      // Elevator car and recognizable sliding doors on both floors.
      for (const level of [0, 1] as const) {
        const y = level === 0 ? 1.35 : -5.65;
        box(-10.5, y, -10.8, 5.2, 3.2, .3, metal);
        box(-12.95, y, -9, .3, 3.2, 3.8, metal);
        box(-8.05, y, -9, .3, 3.2, 3.8, metal);
        box(-11.68, y, -7.2, 2.25, 3, .18, darkMetal);
        box(-9.32, y, -7.2, 2.25, 3, .18, darkMetal);
        const panel = box(-7.88, y, -7.05, .18, .65, .35, new THREE.MeshStandardMaterial({ color: 0x101315, emissive: 0x22bb88, emissiveIntensity: 2 }));
        panel.rotation.y = .1;
      }

      // Basement generator room, lockers and shelves.
      box(9.5, -6.1, 9.5, 3.2, 1.8, 2.2, darkMetal);
      for (let i = 0; i < 5; i++) box(-1 + i * .75, -6.15, 10.8, .6, 1.8, .65, metal);
      for (let i = 0; i < 4; i++) box(9.8, -6.3 + i * .05, -1 + i * 1.2, 2.7, .12, .65, darkMetal);

      const points = [
        [-10, 9, 0], [9, 9, 0], [9, -10, 0], [-2, -10, 0],
        [-10, 9, 1], [9, 9, 1], [9, -10, 1], [-2, -10, 1], [1, 5, 1],
      ] as Array<[number, number, 0 | 1]>;
      const chosen = [...points].sort(() => rnd() - .5).slice(0, 3);
      chosen.forEach(([x, z, level], index) => {
        const group = new THREE.Group();
        const card = new THREE.Mesh(new THREE.BoxGeometry(.42, .07, .65), new THREE.MeshStandardMaterial({ color: index === 0 ? 0x5ed7ff : index === 1 ? 0xffd45e : 0xff6f95, emissive: index === 0 ? 0x14506b : index === 1 ? 0x5d4610 : 0x6a142c, emissiveIntensity: 2.2, metalness: .6, roughness: .25 }));
        card.rotation.x = -.35; group.add(card); group.position.set(x, level === 0 ? .72 : -6.28, z); root.add(group);
        const glow = new THREE.PointLight(card.material instanceof THREE.MeshStandardMaterial ? card.material.color : 0xffffff, 3, 4); glow.position.y = .5; group.add(glow);
        pickables.push({ mesh: group, level, found: false });
      });

      const guard = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34, 1.05, 6, 12), new THREE.MeshStandardMaterial({ color: 0x1a1d21, emissive: 0x260006, roughness: .7 }));
      const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshStandardMaterial({ color: 0x272a2e, roughness: .5 }));
      head.position.y = 1.02;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff314d });
      const eye1 = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), eyeMat); eye1.position.set(-.1, 1.08, -.28);
      const eye2 = eye1.clone(); eye2.position.x = .1;
      guard.add(body, head, eye1, eye2); guard.position.set(8, .8, 8); root.add(guard); guardian = guard;

      exitDoor = box(11.8, -5.55, -12.8, 3.2, 3, .3, new THREE.MeshStandardMaterial({ color: 0x394146, emissive: 0x003322, emissiveIntensity: .4, metalness: .8, roughness: .35 }));
    };

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = rect.width / Math.max(1, rect.height); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();

    const canMove = (x: number, z: number) => Math.abs(x) < 13.35 && Math.abs(z) < 13.35 && !colliders.some((b) => b.level === currentFloor && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
    const start = () => {
      buildWorld(); collected = 0; currentFloor = 0; setFound(0); setFloor(0); setNote(t.mission);
      player.set(0, 1.62, 11); yaw = Math.PI; startedAt = performance.now(); setElapsed(0); running = true; setPhase("playing");
    };
    gameRef.current = { start };
    setReady(true);
    if (startQueuedRef.current) { startQueuedRef.current = false; start(); }
    else buildWorld();

    const clock = new THREE.Clock();
    let animation = 0;
    const animate = () => {
      animation = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), .04);
      if (running) {
        const pressed = keysRef.current;
        if (pressed.q || pressed.arrowleft) yaw += 1.7 * dt;
        if (pressed.e || pressed.arrowright) yaw -= 1.7 * dt;
        const forward = (pressed.w || pressed.arrowup ? 1 : 0) - (pressed.s || pressed.arrowdown ? 1 : 0);
        const side = (pressed.d ? 1 : 0) - (pressed.a ? 1 : 0);
        const speed = 3.25 * dt;
        const nx = player.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed;
        const nz = player.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed;
        if (canMove(nx, player.z)) player.x = nx;
        if (canMove(player.x, nz)) player.z = nz;
        player.y = currentFloor === 0 ? 1.62 : -5.38;
        camera.position.copy(player); camera.rotation.set(0, yaw, 0, "YXZ");
        arms.position.y = Math.sin(performance.now() * .008) * .008 * Math.abs(forward + side);

        const nearElevator = Math.hypot(player.x + 10.5, player.z + 9) < 3;
        if (nearElevator) setNote(t.elevator); else if (!note.includes(t.found)) setNote(t.mission);
        if (pressed.f && nearElevator && performance.now() - lastElevator > 900) {
          lastElevator = performance.now(); currentFloor = currentFloor === 0 ? 1 : 0; setFloor(currentFloor);
          playTone(235, .32, .18);
          player.set(-10.5, currentFloor === 0 ? 1.62 : -5.38, -9); pressed.f = false;
        }

        pickables.forEach((item, index) => {
          if (item.found) return;
          item.mesh.rotation.y += dt * 1.5; item.mesh.position.y += Math.sin(performance.now() * .002 + index) * .001;
          if (item.level === currentFloor && Math.hypot(item.mesh.position.x - player.x, item.mesh.position.z - player.z) < 1.25) {
            item.found = true; item.mesh.visible = false; collected++; setFound(collected); setNote(t.found);
            playTone(620 + collected * 85, .22, .2);
          }
        });
        if (guardian) {
          const guardLevel = guardian.position.y < -2 ? 1 : 0;
          if (guardLevel === currentFloor) {
            const direction = new THREE.Vector3(player.x - guardian.position.x, 0, player.z - guardian.position.z);
            const distance = direction.length();
            if (distance < 15) guardian.position.add(direction.normalize().multiplyScalar(dt * (.55 + collected * .1)));
            guardian.lookAt(player.x, guardian.position.y, player.z);
            if (distance < .75) { running = false; playTone(92, .5, .2); setElapsed(Math.floor((performance.now() - startedAt) / 1000)); setPhase("lost"); }
          } else if (Math.random() < dt * .08) guardian.position.y = currentFloor === 0 ? .8 : -6.2;
        }
        if (exitDoor && collected === 3) {
          const material = exitDoor.material as THREE_TYPES.MeshStandardMaterial; material.emissive.setHex(0x00a86b); material.emissiveIntensity = 2;
          if (currentFloor === 1 && Math.hypot(exitDoor.position.x - player.x, exitDoor.position.z - player.z) < 1.65) {
            running = false;
            const finalTime = Math.max(1, Math.floor((performance.now() - startedAt) / 1000));
            setElapsed(finalTime);
            if (!bestRef.current || finalTime < bestRef.current.time) {
              const next = { name: playerName, time: finalTime };
              bestRef.current = next; setBest(next);
              localStorage.setItem("basement-protocol-best", JSON.stringify(next));
            }
            playTone(880, .48, .2);
            setPhase("won");
          }
        }
        setElapsed(Math.floor((performance.now() - startedAt) / 1000));
      }
      renderer.render(scene, camera);
    };
    animate();
    cleanup = () => {
      cancelAnimationFrame(animation); observer.disconnect(); renderer.dispose(); mount.removeChild(renderer.domElement); gameRef.current = null;
    };
    } catch {
      if (!disposed) { setGameError(true); setReady(false); setPhase("intro"); }
    }
    })();
    return () => { disposed = true; cleanup(); };
  }, [lang, playerName]);

  const beginFilm = () => { startMusic(); setFilmStep(0); setPhase("film"); };
  const requestStart = () => {
    startMusic();
    if (gameRef.current) gameRef.current.start();
    else { startQueuedRef.current = true; setNote(t.loading); }
  };
  const toggleFull = async () => {
    if (expanded) { setExpanded(false); if (document.fullscreenElement) try { await document.exitFullscreen(); } catch {} }
    else { setExpanded(true); try { await shellRef.current?.requestFullscreen?.(); } catch {} }
  };
  const hold = (key: string, on: boolean) => (keysRef.current[key] = on);
  const sceneCopy = t.scenes[filmStep];

  return <div className="haunted realistic-game" ref={shellRef}>
    <div className="gamebar"><div className="leader"><span>{t.leader}</span>{best?<b>{best.name} — {best.time} {t.seconds}</b>:<b>{t.noRecord}</b>}</div><div className="mission"><span>{t.keys} <b>{found}/3</b></span><span>{t.time} <b>{elapsed}</b></span><span>{t.floor} <b>{floor === 0 ? t.ground : t.basement}</b></span></div><div className="game-actions"><button type="button" onClick={toggleMusic}>{soundOn?t.musicOn:t.musicOff}</button><button type="button" onClick={toggleFull}>{expanded ? t.shrink : t.fullscreen}</button></div></div>
    <div className="gameview real-view"><div className="three-mount" ref={mountRef} /><audio ref={soundtrackRef} className="native-audio" src="/audio/basement-ambient-v2.mp3" controls loop preload="auto" onPlay={()=>setSoundOn(true)} onPause={()=>setSoundOn(false)} aria-label={lang==="fa"?"پخش موسیقی بازی":"Game soundtrack"}/>
      {phase === "film" && <div className={`story-film real-film scene-${filmStep}`}><div className="film-noise"/><div className="film-copy" key={filmStep}><small>GAMEVERSE_200 // BASEMENT PROTOCOL</small><h3>{sceneCopy[0]}</h3><p>{sceneCopy[1]}</p>{!ready&&!gameError&&<em className="engine-status">{t.loading}</em>}</div><div className="film-progress"><i style={{width:`${((filmStep+1)/3)*100}%`}}/></div><button type="button" onClick={requestStart}>{t.skip}</button><button type="button" className="film-sound" aria-pressed={soundOn} onClick={toggleMusic}>{soundOn?"🔊":"🔇"} {soundOn?t.musicOn:t.soundHint}</button></div>}
      {phase !== "playing" && phase !== "film" && <div className="startlayer real-start"><span className="new-ribbon">{t.newGame}</span><div className="real-soldier" aria-hidden="true"><i/><b/><span/></div><small>REAL-TIME THREE.JS MISSION</small><h3>{phase === "won" ? t.won : phase === "lost" ? t.lost : t.title}</h3><p>{gameError?t.error:phase === "intro" ? t.intro : t.mission}</p><button type="button" disabled={gameError} onClick={phase === "intro" ? beginFilm : requestStart}>{phase === "intro" ? t.watch : t.retry}</button>{!ready&&!gameError&&<i className="engine-status">{t.loading}</i>}<em>{t.controls}</em></div>}
      {phase === "playing" && <><div className="gamenote">{note}</div><div className="real-hud"><span>◈ {playerName}</span><b>{floor === 0 ? t.ground : t.basement}</b></div></>}
    </div>
    <div className="touch" dir="ltr"><button type="button" onPointerDown={()=>hold("q",true)} onPointerUp={()=>hold("q",false)}>↶</button><div><button type="button" onPointerDown={()=>hold("w",true)} onPointerUp={()=>hold("w",false)}>↑</button><span><button type="button" onPointerDown={()=>hold("a",true)} onPointerUp={()=>hold("a",false)}>←</button><button type="button" onPointerDown={()=>hold("s",true)} onPointerUp={()=>hold("s",false)}>↓</button><button type="button" onPointerDown={()=>hold("d",true)} onPointerUp={()=>hold("d",false)}>→</button></span></div><button type="button" className="elevator-touch" onPointerDown={()=>hold("f",true)} onPointerUp={()=>hold("f",false)}>F</button><button type="button" onPointerDown={()=>hold("e",true)} onPointerUp={()=>hold("e",false)}>↷</button></div>
  </div>;
}
