import { readFileSync } from "node:fs";
const { mode } = JSON.parse(readFileSync(0, "utf8"));
if (mode === "timeout") setInterval(() => {}, 1000);
if (mode === "signal") process.kill(process.pid, "SIGTERM");
if (mode === "overflow") process.stdout.write("x".repeat(100000));
if (mode === "invalid") process.stdout.write("not JSON");
