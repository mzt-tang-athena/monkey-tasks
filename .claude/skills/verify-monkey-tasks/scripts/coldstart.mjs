// Reads the runs android-coldstart.sh kept and prints one table.
//
//   node coldstart.mjs <folder with run-N/>
//
// Every time is milliseconds since the launch began: the start of the
// "launching: <package>" slice in the trace, which opens when the
// activity manager gets the intent. The app's marks carry the device's
// wall clock, and the trace's clock snapshot moves them onto the trace
// clock.
//
//   first frame   am start -W TotalTime, the platform's own number
//   js start      the first line of the bundle ran
//   root          the root layout rendered
//   root read     the saved vault folder was read
//   load start    the vault read began
//   folders       Tasks/ and Deeds/ were found
//   load done     every note was listed, read and parsed
//   rows ready    the store committed the first rows
//   rows drawn    the render thread finished the first frame after
//                 the rows' text reached the screen
//   main idle     the first moment after rows ready from which the
//                 main thread ran under 10% of the next 500 ms
//
// Then the main thread's and the JS thread's CPU time between the
// stages. CPU time moves less than wall time when the host is busy.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const folder = process.argv[2];
if (folder == null) {
  console.error("usage: coldstart.mjs <folder>");
  process.exit(2);
}
const PKG = "dev.monkey.monkeytasks";

function traceProcessor() {
  if (process.env.TRACE_PROCESSOR) {
    return process.env.TRACE_PROCESSOR;
  }
  const dir = join(homedir(), ".local/share/perfetto/prebuilts");
  const found = existsSync(dir)
    ? readdirSync(dir).find((name) => name.startsWith("trace_processor_shell"))
    : undefined;
  if (found == null) {
    console.error("no trace_processor_shell: set TRACE_PROCESSOR");
    process.exit(2);
  }
  return join(dir, found);
}
const TP = traceProcessor();
const scratch = mkdtempSync(join(tmpdir(), "coldstart-"));

function csv(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function query(trace, sql) {
  const file = join(scratch, "q.sql");
  writeFileSync(file, sql);
  const result = spawnSync(TP, ["-q", file, trace], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  if (result.status !== 0) {
    throw new Error(`trace_processor failed: ${result.stderr}`);
  }
  const lines = result.stdout.split("\n").filter((line) => line !== "");
  const [head, ...rows] = lines;
  const keys = csv(head);
  return rows.map((row) => {
    const cells = csv(row);
    return Object.fromEntries(keys.map((key, i) => [key, cells[i]]));
  });
}

const proc = `p.name = '${PKG}'`;
const onApp = `from slice s join thread_track tt on s.track_id = tt.id join thread t using(utid) join process p using(upid)`;

function cpu(slices, from, to) {
  let sum = 0;
  for (const [ts, dur] of slices) {
    const a = Math.max(ts, from);
    const b = Math.min(ts + dur, to);
    if (b > a) {
      sum += b - a;
    }
  }
  return sum / 1e6;
}

function runOf(dir) {
  const trace = join(dir, "trace.pftrace");
  const log = readFileSync(join(dir, "logcat.txt"), "utf8");
  const am = readFileSync(join(dir, "am-start.txt"), "utf8");
  const total = Number(/TotalTime: (\d+)/.exec(am)?.[1]);

  const snap = query(
    trace,
    `select c.ts, c.clock_value from clock_snapshot c where c.clock_name = 'REALTIME' order by c.ts limit 1;`,
  )[0];
  const bootToEpochNs = Number(snap.clock_value) - Number(snap.ts);

  const launch = query(
    trace,
    `select ts, dur from slice where name = 'launching: ${PKG}' order by ts limit 1;`,
  )[0];
  const t0 = Number(launch.ts);
  const rel = (ns) => (ns - t0) / 1e6;

  const marks = {};
  for (const match of log.matchAll(/startup-mark ([\w-]+) (\d+)\s*$/gm)) {
    if (marks[match[1]] == null) {
      marks[match[1]] = Number(match[2]) * 1e6 - bootToEpochNs;
    }
  }

  const first = (name, like = false) => {
    const [row] = query(
      trace,
      `select s.ts, s.dur ${onApp} where ${proc} and s.name ${like ? "like" : "="} '${name}' order by s.ts limit 1;`,
    );
    return row == null ? null : { ts: Number(row.ts), dur: Number(row.dur) };
  };

  const main = query(
    trace,
    `select s.ts, s.dur from sched s join thread t using(utid) join process p using(upid) where ${proc} and t.tid = p.pid order by s.ts;`,
  ).map((r) => [Number(r.ts), Number(r.dur)]);
  const js = query(
    trace,
    `select s.ts, s.dur from sched s join thread t using(utid) join process p using(upid) where ${proc} and t.name = 'mqt_v_js' order by s.ts;`,
  ).map((r) => [Number(r.ts), Number(r.dur)]);

  const rowsAt = marks["rows-ready"];
  let drawn = null;
  let idle = null;
  if (rowsAt != null) {
    const [text] = query(
      trace,
      `select s.ts ${onApp} where ${proc} and s.name like 'ReactTextView.setText%' and s.ts >= ${rowsAt} order by s.ts limit 1;`,
    );
    if (text != null) {
      const [frame] = query(
        trace,
        `select s.ts + s.dur as e ${onApp} where ${proc} and t.name = 'RenderThread' and s.name like 'DrawFrames%' and s.ts >= ${text.ts} order by s.ts limit 1;`,
      );
      drawn = frame == null ? null : Number(frame.e);
    }
    const end = main.length === 0 ? rowsAt : main[main.length - 1][0];
    for (let at = rowsAt; at + 5e8 <= end; at += 5e7) {
      if (cpu(main, at, at + 5e8) < 50) {
        idle = at;
        break;
      }
    }
  }

  let vault = null;
  if (marks["load-start"] != null && marks["load-done"] != null) {
    const a = marks["load-start"];
    const b = marks["load-done"];
    const clip = `max(0, min(s.ts + s.dur, ${b}) - max(s.ts, ${a}))`;
    const byProcess = query(
      trace,
      `select coalesce(p.name, 'idle') as n, sum(${clip}) / 1e6 as ms from sched s join thread t using(utid) left join process p using(upid) where t.tid > 0 and s.ts < ${b} and s.ts + s.dur > ${a} group by n order by ms desc limit 6;`,
    );
    const appThreads = query(
      trace,
      `select t.name as n, sum(${clip}) / 1e6 as ms from sched s join thread t using(utid) join process p using(upid) where ${proc} and s.ts < ${b} and s.ts + s.dur > ${a} group by t.tid order by ms desc limit 5;`,
    );
    vault = {
      windowMs: (b - a) / 1e6,
      byProcess: byProcess.map((r) => [r.n, Number(r.ms)]),
      appThreads: appThreads.map((r) => [r.n, Number(r.ms)]),
    };
  }

  const stage = [
    ["js start", marks["js-start"]],
    ["root", marks["root-render"]],
    ["root read", marks["root-read"]],
    ["load start", marks["load-start"]],
    ["folders", marks["folders-found"]],
    ["load done", marks["load-done"]],
    ["rows visible", marks["rows-visible"]],
    ["rows ready", rowsAt],
    ["rows drawn", drawn],
    ["main idle", idle],
  ];
  const times = { "first frame": total };
  for (const [name, at] of stage) {
    times[name] = at == null ? null : rel(at);
  }

  const bind = first("bindApplication");
  const react = first("ReactInstance.initialize");
  const fork = first("PostFork");
  const detail = {
    "process forked": fork == null ? null : rel(fork.ts),
    "bindApplication end": bind == null ? null : rel(bind.ts + bind.dur),
    "ReactInstance.initialize": react == null ? null : react.dur / 1e6,
  };

  const windows = [
    ["launch to js start", t0, marks["js-start"]],
    ["js start to load done", marks["js-start"], marks["load-done"]],
    ["load done to rows ready", marks["load-done"], rowsAt],
    ["rows ready to +3 s", rowsAt, rowsAt == null ? null : rowsAt + 3e9],
  ];
  const cpuMs = {};
  for (const [name, from, to] of windows) {
    if (from != null && to != null) {
      cpuMs[`main cpu, ${name}`] = cpu(main, from, to);
      cpuMs[`js cpu, ${name}`] = cpu(js, from, to);
    }
  }
  const load = Number(readFileSync(join(dir, "host-load.txt"), "utf8"));
  return { times, detail, cpuMs, vault, host: { "host load, 1 min average": load } };
}

const dirs = readdirSync(folder)
  .filter((name) => /^run-\d+$/.test(name))
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
const results = dirs.map((name) => runOf(join(folder, name)));
writeFileSync(join(folder, "result.json"), JSON.stringify(results, null, 2));

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (s.length === 0) {
    return null;
  }
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (x) => (x == null ? "-" : String(Math.round(x * 10) / 10)).padStart(7);
function table(title, key) {
  console.log(`\n${title}`.padEnd(30) + dirs.map((_, i) => `run ${i + 1}`.padStart(7)).join("") + "   median    range");
  for (const name of Object.keys(results[0][key])) {
    const xs = results.map((r) => r[key][name]);
    const have = xs.filter((x) => x != null);
    const range = have.length === 0 ? null : Math.max(...have) - Math.min(...have);
    console.log(name.padEnd(30) + xs.map(fmt).join("") + fmt(median(xs)).padStart(9) + fmt(range).padStart(9));
  }
}
console.log(`cold start, ms since launch (${folder})`);
table("stage", "times");
table("native", "detail");
table("host", "host");
table("cpu ms", "cpuMs");
results.forEach((r, i) => {
  if (r.vault != null) {
    const top = (rows) => rows.map(([n, ms]) => `${n} ${Math.round(ms)}`).join(", ");
    console.log(`\nrun ${i + 1} vault read, ${Math.round(r.vault.windowMs)} ms of wall time, cpu ms by process: ${top(r.vault.byProcess)}`);
    console.log(`  app threads: ${top(r.vault.appThreads)}`);
  }
});
