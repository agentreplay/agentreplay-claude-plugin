var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/common.js
var require_common = __commonJS({
  "src/common.js"(exports2, module2) {
    var nodeOs = require("node:os");
    var nodePath = require("node:path");
    var nodeFs = require("node:fs");
    var nodeCrypto = require("node:crypto");
    var CONFIG_DIR = nodePath.join(nodeOs.homedir(), ".agentreplay-claude");
    var CONFIG_FILE = nodePath.join(CONFIG_DIR, "config.json");
    var STATE_DIR = nodePath.join(CONFIG_DIR, "state");
    var DEFAULTS = Object.freeze({
      serverUrl: "http://localhost:47100",
      tenantId: 1,
      projectId: 1,
      tracingEnabled: true,
      memoryEnabled: true,
      verbose: false,
      contextLimit: 5,
      ignoredTools: ["Read", "Glob", "Grep", "TodoWrite", "LS"]
    });
    function loadConfig2() {
      const cfg = { ...DEFAULTS };
      try {
        if (nodeFs.existsSync(CONFIG_FILE)) {
          Object.assign(cfg, JSON.parse(nodeFs.readFileSync(CONFIG_FILE, "utf8")));
        }
      } catch {
      }
      const env = process.env;
      if (env.AGENTREPLAY_URL) cfg.serverUrl = env.AGENTREPLAY_URL;
      if (env.AGENTREPLAY_TENANT_ID) cfg.tenantId = Number(env.AGENTREPLAY_TENANT_ID);
      if (env.AGENTREPLAY_PROJECT_ID) cfg.projectId = Number(env.AGENTREPLAY_PROJECT_ID);
      if (env.AGENTREPLAY_TRACING === "false") cfg.tracingEnabled = false;
      if (env.AGENTREPLAY_MEMORY === "false") cfg.memoryEnabled = false;
      if (env.AGENTREPLAY_DEBUG === "true" || env.AGENTREPLAY_DEBUG === "1") cfg.verbose = true;
      return cfg;
    }
    function log2(cfg, tag, data = null) {
      if (!cfg.verbose) return;
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      const msg = data ? `[${ts}] ${tag}: ${JSON.stringify(data)}` : `[${ts}] ${tag}`;
      process.stderr.write(msg + "\n");
    }
    function computeWorkspaceId(dirPath) {
      if (!dirPath) return "ws_default";
      const abs = nodePath.resolve(dirPath);
      const hash = nodeCrypto.createHash("sha1").update(abs).digest("hex").slice(0, 12);
      const name = nodePath.basename(abs).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
      return name ? `ws_${name}_${hash}` : `ws_${hash}`;
    }
    function extractProjectName(dirPath) {
      if (!dirPath) return "Untitled";
      return nodePath.basename(nodePath.resolve(dirPath));
    }
    function ensureStateDir() {
      if (!nodeFs.existsSync(STATE_DIR)) {
        nodeFs.mkdirSync(STATE_DIR, { recursive: true, mode: 448 });
      }
    }
    function readState(key) {
      try {
        const fp = nodePath.join(STATE_DIR, `${key}.json`);
        if (nodeFs.existsSync(fp)) {
          return JSON.parse(nodeFs.readFileSync(fp, "utf8"));
        }
      } catch {
      }
      return {};
    }
    function writeState(key, data) {
      ensureStateDir();
      const fp = nodePath.join(STATE_DIR, `${key}.json`);
      nodeFs.writeFileSync(fp, JSON.stringify(data), "utf8");
    }
    function parseStdin2() {
      return new Promise((resolve, reject) => {
        if (process.stdin.isTTY) {
          resolve({});
          return;
        }
        const chunks = [];
        process.stdin.setEncoding("utf8");
        process.stdin.on("readable", () => {
          let c;
          while ((c = process.stdin.read()) !== null) chunks.push(c);
        });
        process.stdin.on("end", () => {
          const raw = chunks.join("");
          if (!raw.trim()) {
            resolve({});
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Invalid JSON: ${e.message}`));
          }
        });
        process.stdin.on("error", reject);
      });
    }
    function respond2(payload) {
      process.stdout.write(JSON.stringify(payload) + "\n");
    }
    function done(additionalContext = null) {
      if (additionalContext) {
        respond2({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } });
      } else {
        respond2({ continue: true, suppressOutput: true });
      }
    }
    module2.exports = {
      loadConfig: loadConfig2,
      log: log2,
      computeWorkspaceId,
      extractProjectName,
      readState,
      writeState,
      parseStdin: parseStdin2,
      respond: respond2,
      done,
      CONFIG_DIR,
      STATE_DIR
    };
  }
});

// src/hooks/prompt.js
var { loadConfig, log, parseStdin, respond } = require_common();
(async () => {
  const cfg = loadConfig();
  try {
    const input = await parseStdin();
    log(cfg, "UserPrompt", { session: input.session_id });
    respond({ continue: true, suppressOutput: true });
  } catch (err) {
    log(cfg, "Hook error", err.message);
    respond({ continue: true, suppressOutput: true });
  }
})();
