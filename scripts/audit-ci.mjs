import { spawnSync } from "node:child_process";

const allowedAdvisories = new Set(["GHSA-vfj7-8cjw-p6xm"]);
const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };

const audit =
  process.platform === "win32"
    ? spawnSync(process.env.ComSpec, ["/d", "/s", "/c", "npm audit --json"], {
        encoding: "utf8",
      })
    : spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });

if (audit.error || !audit.stdout.trim()) {
  console.error("Unable to run npm audit.");
  if (audit.error) console.error(audit.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(
    "npm audit returned invalid JSON; refusing to bypass the security gate.",
  );
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const memo = new Map();

function isAllowlisted(name, visiting = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (visiting.has(name)) return false;

  const vulnerability = vulnerabilities[name];
  if (
    !vulnerability ||
    !Array.isArray(vulnerability.via) ||
    vulnerability.via.length === 0
  ) {
    return false;
  }

  const nextVisiting = new Set(visiting).add(name);
  const allowed = vulnerability.via.every((cause) => {
    if (typeof cause === "string") return isAllowlisted(cause, nextVisiting);
    if (!cause || typeof cause.url !== "string") return false;
    const advisoryId = cause.url.split("/").pop();
    return allowedAdvisories.has(advisoryId);
  });

  memo.set(name, allowed);
  return allowed;
}

const relevant = Object.entries(vulnerabilities).filter(
  ([, vulnerability]) =>
    (severityRank[vulnerability.severity] ?? 0) >= severityRank.high,
);
const blocked = relevant.filter(([name]) => !isAllowlisted(name));
const allowed = relevant.filter(([name]) => isAllowlisted(name));

if (allowed.length > 0) {
  console.warn(
    `Temporarily allowing ${[...allowedAdvisories].join(", ")} and its dependency chain: ${allowed
      .map(([name]) => name)
      .join(", ")}`,
  );
}

if (blocked.length > 0) {
  console.error(
    "npm audit found non-allowlisted high or critical vulnerabilities:",
  );
  for (const [name, vulnerability] of blocked) {
    console.error(`- ${name} (${vulnerability.severity})`);
  }
  process.exit(1);
}

console.log("No non-allowlisted high or critical npm vulnerabilities found.");
