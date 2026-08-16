"use client";

import { useEffect, useRef, useState } from "react";

type Lang = "fa" | "en";
type Phase = "intro" | "cinematic" | "playing" | "lost" | "won";
type Point = { x: number; y: number };
type Item = Point & { got: boolean };
type Leader = { name: string; time: number } | null;

type Runtime = {
  running: boolean;
  maze: string[];
  p: Point & { a: number };
  e: Point;
  items: Item[];
  exit: Point;
  start: number;
  last: number;
};

const copy = {
  fa: {
    leader: "♛ رکورد نفر اول",
    empty: "هنوز رکوردی ثبت نشده",
    keys: "کلیدها",
    clock: "زمان",
    expand: "⛶ بزرگ‌نمایی",
    shrink: "کوچک‌نمایی",
    title: "عملیات: خانهٔ سایه‌ها",
    intro: "در نقش سرباز ریون-۷ وارد پایگاه شو؛ نقشه و محل کلیدها در هر عملیات تغییر می‌کند.",
    player: "نام سرباز",
    placeholder: "نامت را بنویس",
    movie: "▶ تماشای فیلم و شروع عملیات",
    retry: "پخش دوبارهٔ داستان و تلاش جدید",
    skip: "رد کردن فیلم و شروع",
    lost: "نگهبان پیدایت کرد!",
    won: "سیگنال خاموش شد؛ مأموریت موفق بود!",
    mission: "سه کلید دسترسی را پیدا کن و به اتاق کنترل برس.",
    found: "کلید پیدا شد؛ نگهبان سریع‌تر شد.",
    controls: "حرکت: W A S D • چرخش: ← → یا Q E",
    seconds: "ثانیه",
    soldier: "سرباز ریون-۷",
    scenes: [
      ["پیام اضطراری ۰۳:۱۷", "پایگاه رلهٔ شهر خاموش شده است. سرباز ریون-۷ برای برگرداندن برق وارد منطقه می‌شود."],
      ["قفل امنیتی فعال شد", "نگهبان هوشمند، کلید اصلی اتاق کنترل را به سه قطعه تقسیم و در راهروها پنهان کرده است."],
      ["هدف عملیات", "سه کلید را پیدا کن، درِ اتاق کنترل را باز کن و سیگنال سایه را پیش از رسیدن نگهبان خاموش کن."],
    ],
  },
  en: {
    leader: "♛ TOP RECORD",
    empty: "No record yet",
    keys: "Keys",
    clock: "Time",
    expand: "⛶ Fullscreen",
    shrink: "Exit fullscreen",
    title: "Operation: Shadow House",
    intro: "Play as soldier Raven-7. The maze and key locations change on every mission.",
    player: "Soldier name",
    placeholder: "Enter your name",
    movie: "▶ Watch story film & start",
    retry: "Replay story & start a new mission",
    skip: "Skip film & deploy",
    lost: "The guardian found you!",
    won: "Signal disabled. Mission complete!",
    mission: "Find three access keys and reach the control room.",
    found: "Key recovered. The guardian is faster now.",
    controls: "Move: W A S D • Turn: ← → or Q E",
    seconds: "seconds",
    soldier: "SOLDIER RAVEN-7",
    scenes: [
      ["EMERGENCY SIGNAL 03:17", "The city's relay station is dark. Soldier Raven-7 enters the zone to restore its power."],
      ["SECURITY LOCK ENGAGED", "The intelligent guardian split the master control key into three pieces and hid them in the corridors."],
      ["MISSION OBJECTIVE", "Recover all three keys, unlock the control room, and disable the shadow signal before the guardian arrives."],
    ],
  },
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createLevel(size = 15) {
  const grid = Array.from({ length: size }, () => Array(size).fill(1));
  const stack: Array<[number, number]> = [[1, 1]];
  grid[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = shuffle([
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ] as Array<[number, number]>).filter(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx > 0 && ny > 0 && nx < size - 1 && ny < size - 1 && grid[ny][nx] === 1;
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[0];
    grid[y + dy / 2][x + dx / 2] = 0;
    grid[y + dy][x + dx] = 0;
    stack.push([x + dx, y + dy]);
  }

  const cells: Point[] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) if (grid[y][x] === 0) cells.push({ x: x + 0.5, y: y + 0.5 });
  }
  const player = shuffle(cells)[0];
  const far = [...cells].sort(
    (a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y),
  );
  const exit = far[0];
  const enemy = far[Math.min(5, far.length - 1)];
  const candidates = far.filter(
    (p) => Math.hypot(p.x - exit.x, p.y - exit.y) > 2 && Math.hypot(p.x - enemy.x, p.y - enemy.y) > 1.5,
  );
  const picked: Point[] = [];
  for (const point of candidates) {
    if (picked.every((other) => Math.hypot(point.x - other.x, point.y - other.y) > 3)) picked.push(point);
    if (picked.length === 3) break;
  }
  for (const point of candidates) {
    if (!picked.includes(point)) picked.push(point);
    if (picked.length === 3) break;
  }
  return {
    maze: grid.map((row) => row.join("")),
    player,
    enemy,
    exit,
    items: picked.map((point) => ({ ...point, got: false })),
  };
}

function cleanName(value: string) {
  return value.trim().replace(/[<>]/g, "").slice(0, 18) || "Raven-7";
}

export default function ShadowHouse({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pressed = useRef<Record<string, boolean>>({});
  const initial = useRef(createLevel());
  const state = useRef<Runtime>({
    running: false,
    maze: initial.current.maze,
    p: { ...initial.current.player, a: 0 },
    e: initial.current.enemy,
    items: initial.current.items,
    exit: initial.current.exit,
    start: 0,
    last: 0,
  });
  const [phase, setPhase] = useState<Phase>("intro");
  const [movieStep, setMovieStep] = useState(0);
  const [name, setName] = useState("");
  const [found, setFound] = useState(0);
  const [time, setTime] = useState(0);
  const [note, setNote] = useState(t.mission);
  const [leader, setLeader] = useState<Leader>(null);
  const [expanded, setExpanded] = useState(false);

  const wall = (x: number, y: number) => state.current.maze[Math.floor(y)]?.[Math.floor(x)] !== "0";
  const free = (x: number, y: number) =>
    !wall(x + 0.17, y) && !wall(x - 0.17, y) && !wall(x, y + 0.17) && !wall(x, y - 0.17);

  const start = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const level = createLevel();
    pressed.current = {};
    state.current = {
      running: true,
      maze: level.maze,
      p: { ...level.player, a: Math.random() * Math.PI * 2 },
      e: level.enemy,
      items: level.items,
      exit: level.exit,
      start: performance.now(),
      last: performance.now(),
    };
    setFound(0);
    setTime(0);
    setNote(t.mission);
    setPhase("playing");
  };

  const playMovie = () => {
    setMovieStep(0);
    setPhase("cinematic");
  };

  useEffect(() => {
    if (phase !== "cinematic") return;
    const timers = [
      window.setTimeout(() => setMovieStep(1), 2700),
      window.setTimeout(() => setMovieStep(2), 5400),
      window.setTimeout(start, 8300),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("shadow-house-leader-v2");
      if (saved) setLeader(JSON.parse(saved));
    } catch {
      localStorage.removeItem("shadow-house-leader-v2");
    }
    const down = (event: KeyboardEvent) => {
      pressed.current[event.key.toLowerCase()] = true;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(event.key.toLowerCase())) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => (pressed.current[event.key.toLowerCase()] = false);
    const fullscreen = () => setExpanded(document.fullscreenElement === shellRef.current);
    const external = () => playMovie();
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("start-shadow-house", external);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("start-shadow-house", external);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [lang]);

  useEffect(() => {
    if (!expanded) return;
    const shell = shellRef.current;
    const previous = document.body.style.overflow;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) setExpanded(false);
    };
    shell?.classList.add("expanded");
    document.body.style.overflow = "hidden";
    addEventListener("keydown", escape);
    return () => {
      shell?.classList.remove("expanded");
      document.body.style.overflow = previous;
      removeEventListener("keydown", escape);
    };
  }, [expanded]);

  const finish = (won: boolean) => {
    const runtime = state.current;
    runtime.running = false;
    const final = Math.floor((performance.now() - runtime.start) / 1000);
    setTime(final);
    setPhase(won ? "won" : "lost");
    if (won && (!leader || final < leader.time)) {
      const next = { name: cleanName(name), time: final };
      localStorage.setItem("shadow-house-leader-v2", JSON.stringify(next));
      setLeader(next);
    }
  };

  const toggleFull = async () => {
    if (expanded) {
      setExpanded(false);
      if (document.fullscreenElement) try { await document.exitFullscreen(); } catch {}
      return;
    }
    setExpanded(true);
    try { await shellRef.current?.requestFullscreen?.(); } catch {}
  };

  const hold = (key: string, on: boolean) => (pressed.current[key] = on);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const fov = Math.PI / 3;

    const sprite = (point: Point, kind: "key" | "guard" | "exit", depth: number[], width: number, height: number) => {
      const runtime = state.current;
      const dx = point.x - runtime.p.x;
      const dy = point.y - runtime.p.y;
      const distance = Math.hypot(dx, dy);
      let angle = Math.atan2(dy, dx) - runtime.p.a;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      if (Math.abs(angle) > fov * 0.7 || distance < 0.2) return;
      const screenX = width / 2 + (Math.tan(angle) / Math.tan(fov / 2)) * (width / 2);
      const column = Math.max(0, Math.min(depth.length - 1, Math.floor((screenX / width) * depth.length)));
      if (distance > depth[column] + 0.4) return;
      const size = Math.min(height * 0.82, (height / distance) * (kind === "guard" ? 0.9 : 0.42));
      ctx.save();
      ctx.translate(screenX, height / 2 + size * 0.18);
      if (kind === "key") {
        ctx.shadowBlur = 28;
        ctx.shadowColor = "#ffe27a";
        ctx.strokeStyle = "#fff0a8";
        ctx.lineWidth = Math.max(2, size * 0.045);
        ctx.beginPath();
        ctx.arc(0, -size * 0.16, size * 0.15, 0, Math.PI * 2);
        ctx.moveTo(size * 0.15, -size * 0.16);
        ctx.lineTo(size * 0.48, -size * 0.16);
        ctx.lineTo(size * 0.48, size * 0.05);
        ctx.moveTo(size * 0.32, -size * 0.16);
        ctx.lineTo(size * 0.32, 0);
        ctx.stroke();
      } else if (kind === "exit") {
        ctx.shadowBlur = 35;
        ctx.shadowColor = "#56ffc1";
        ctx.fillStyle = "rgba(45,255,180,.5)";
        ctx.fillRect(-size * 0.22, -size * 0.55, size * 0.44, size * 0.75);
        ctx.strokeStyle = "#a4ffde";
        ctx.lineWidth = Math.max(2, size * 0.025);
        ctx.strokeRect(-size * 0.22, -size * 0.55, size * 0.44, size * 0.75);
      } else {
        ctx.shadowBlur = 35;
        ctx.shadowColor = "#d12d54";
        const gradient = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        gradient.addColorStop(0, "#7c2944");
        gradient.addColorStop(1, "#10080d");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, -size * 0.33, size * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-size * 0.18, -size * 0.2);
        ctx.lineTo(-size * 0.26, size * 0.45);
        ctx.lineTo(size * 0.26, size * 0.45);
        ctx.lineTo(size * 0.18, -size * 0.2);
        ctx.fill();
        ctx.fillStyle = "#ff5270";
        ctx.beginPath();
        ctx.arc(-size * 0.05, -size * 0.35, Math.max(1.5, size * 0.013), 0, Math.PI * 2);
        ctx.arc(size * 0.05, -size * 0.35, Math.max(1.5, size * 0.013), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const render = (now: number) => {
      const runtime = state.current;
      if (!runtime.running) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      const dt = Math.min((now - runtime.last) / 1000, 0.04);
      runtime.last = now;
      const p = runtime.p;
      const turn = 1.85 * dt;
      const move = 2 * dt;
      if (pressed.current.arrowleft || pressed.current.q) p.a -= turn;
      if (pressed.current.arrowright || pressed.current.e) p.a += turn;
      const forward = (pressed.current.w || pressed.current.arrowup ? 1 : 0) - (pressed.current.s || pressed.current.arrowdown ? 1 : 0);
      const strafe = (pressed.current.d ? 1 : 0) - (pressed.current.a ? 1 : 0);
      const nx = p.x + (Math.cos(p.a) * forward + Math.cos(p.a + Math.PI / 2) * strafe) * move;
      const ny = p.y + (Math.sin(p.a) * forward + Math.sin(p.a + Math.PI / 2) * strafe) * move;
      if (free(nx, p.y)) p.x = nx;
      if (free(p.x, ny)) p.y = ny;

      const enemy = runtime.e;
      const enemyDistance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
      const collected = runtime.items.filter((item) => item.got).length;
      if (enemyDistance < 10) {
        const speed = (0.44 + collected * 0.08) * dt;
        const ex = enemy.x + ((p.x - enemy.x) / Math.max(enemyDistance, 0.01)) * speed;
        const ey = enemy.y + ((p.y - enemy.y) / Math.max(enemyDistance, 0.01)) * speed;
        if (free(ex, enemy.y)) enemy.x = ex;
        if (free(enemy.x, ey)) enemy.y = ey;
      }
      if (enemyDistance < 0.48) {
        finish(false);
        return;
      }
      runtime.items.forEach((item) => {
        if (!item.got && Math.hypot(p.x - item.x, p.y - item.y) < 0.42) {
          item.got = true;
          setNote(t.found);
        }
      });
      const total = runtime.items.filter((item) => item.got).length;
      if (total !== found) setFound(total);
      if (total === 3 && Math.hypot(p.x - runtime.exit.x, p.y - runtime.exit.y) < 0.65) {
        finish(true);
        return;
      }
      setTime(Math.floor((now - runtime.start) / 1000));

      const ceiling = ctx.createLinearGradient(0, 0, 0, height / 2);
      ceiling.addColorStop(0, "#010206");
      ceiling.addColorStop(1, "#151923");
      ctx.fillStyle = ceiling;
      ctx.fillRect(0, 0, width, height / 2);
      const floor = ctx.createLinearGradient(0, height / 2, 0, height);
      floor.addColorStop(0, "#181a20");
      floor.addColorStop(1, "#020305");
      ctx.fillStyle = floor;
      ctx.fillRect(0, height / 2, width, height / 2);
      const rays = Math.min(440, Math.floor(width / 2));
      const depth: number[] = [];
      for (let i = 0; i < rays; i++) {
        const rayAngle = p.a - fov / 2 + (i / rays) * fov;
        let distance = 0.02;
        let hitX = 0;
        let hitY = 0;
        while (distance < 22) {
          hitX = p.x + Math.cos(rayAngle) * distance;
          hitY = p.y + Math.sin(rayAngle) * distance;
          if (wall(hitX, hitY)) break;
          distance += 0.035;
        }
        const corrected = distance * Math.cos(rayAngle - p.a);
        depth.push(corrected);
        const wallHeight = Math.min(height * 1.7, (height / Math.max(0.15, corrected)) * 0.78);
        const shade = Math.max(18, 120 - corrected * 11);
        const side = Math.abs((hitX % 1) - 0.5) > Math.abs((hitY % 1) - 0.5) ? 0.78 : 1;
        ctx.fillStyle = `rgb(${shade * side},${(shade + 7) * side},${(shade + 14) * side})`;
        ctx.fillRect((i * width) / rays, height / 2 - wallHeight / 2, width / rays + 1, wallHeight);
      }
      runtime.items.filter((item) => !item.got).forEach((item) => sprite(item, "key", depth, width, height));
      sprite(runtime.e, "guard", depth, width, height);
      if (total === 3) sprite(runtime.exit, "exit", depth, width, height);
      const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.07, width / 2, height / 2, height * 0.72);
      vignette.addColorStop(0, "rgba(255,244,205,.03)");
      vignette.addColorStop(0.55, "rgba(0,0,0,.08)");
      vignette.addColorStop(1, "rgba(0,0,0,.95)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.beginPath();
      ctx.moveTo(width / 2 - 8, height / 2);
      ctx.lineTo(width / 2 + 8, height / 2);
      ctx.moveTo(width / 2, height / 2 - 8);
      ctx.lineTo(width / 2, height / 2 + 8);
      ctx.stroke();
      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase]);

  const scene = t.scenes[movieStep];
  return (
    <div className="haunted shadow-v2" ref={shellRef} dir={lang === "fa" ? "rtl" : "ltr"}>
      <div className="gamebar">
        <div className="leader">
          <span>{t.leader}</span>
          <b>{leader ? `${leader.name} — ${leader.time.toLocaleString(lang === "fa" ? "fa-IR" : "en-US")} ${t.seconds}` : t.empty}</b>
        </div>
        <div className="mission">
          <span>{t.keys} <b>{found.toLocaleString(lang === "fa" ? "fa-IR" : "en-US")} / 3</b></span>
          <span>{t.clock} <b>{time.toLocaleString(lang === "fa" ? "fa-IR" : "en-US")}</b></span>
        </div>
        <button type="button" onClick={toggleFull}>{expanded ? t.shrink : t.expand}</button>
      </div>
      <div className="gameview">
        <canvas ref={canvasRef} aria-label="Shadow House randomized 3D game" />
        {phase === "cinematic" && (
          <div className={`story-film scene-${movieStep}`}>
            <div className="film-noise" />
            <div className="soldier-scene" aria-hidden="true"><i /><b /><span /></div>
            <div className="film-copy" key={movieStep}>
              <small>GAMEVERSE_200 // SHADOW HOUSE</small>
              <h3>{scene[0]}</h3>
              <p>{scene[1]}</p>
            </div>
            <div className="film-progress"><i style={{ width: `${((movieStep + 1) / 3) * 100}%` }} /></div>
            <button type="button" onClick={start}>{t.skip}</button>
          </div>
        )}
        {phase !== "playing" && phase !== "cinematic" && (
          <div className="startlayer soldier-start">
            <div className="soldier-badge" aria-hidden="true"><i /><b /><span /></div>
            <small>SHADOW HOUSE 3D // RANDOM MISSION</small>
            <h3>{phase === "lost" ? t.lost : phase === "won" ? t.won : t.title}</h3>
            <p>{phase === "won" ? `${time.toLocaleString(lang === "fa" ? "fa-IR" : "en-US")} ${t.seconds}` : t.intro}</p>
            <label>{t.player}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={18} placeholder={t.placeholder} /></label>
            <button type="button" onClick={playMovie}>{phase === "intro" ? t.movie : t.retry}</button>
            <em>{t.controls}</em>
          </div>
        )}
        {phase === "playing" && (
          <>
            <div className="gamenote">{note}</div>
            <div className="soldier-hud" aria-label={t.soldier}><i /><b /><span /><em>{t.soldier}</em></div>
          </>
        )}
      </div>
      <div className="touch" dir="ltr">
        <button type="button" onPointerDown={() => hold("q", true)} onPointerUp={() => hold("q", false)} onPointerCancel={() => hold("q", false)}>↶</button>
        <div>
          <button type="button" onPointerDown={() => hold("w", true)} onPointerUp={() => hold("w", false)} onPointerCancel={() => hold("w", false)}>↑</button>
          <span>
            <button type="button" onPointerDown={() => hold("a", true)} onPointerUp={() => hold("a", false)} onPointerCancel={() => hold("a", false)}>←</button>
            <button type="button" onPointerDown={() => hold("s", true)} onPointerUp={() => hold("s", false)} onPointerCancel={() => hold("s", false)}>↓</button>
            <button type="button" onPointerDown={() => hold("d", true)} onPointerUp={() => hold("d", false)} onPointerCancel={() => hold("d", false)}>→</button>
          </span>
        </div>
        <button type="button" onPointerDown={() => hold("e", true)} onPointerUp={() => hold("e", false)} onPointerCancel={() => hold("e", false)}>↷</button>
      </div>
    </div>
  );
}
