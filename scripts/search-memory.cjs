var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/api.js
var require_api = __commonJS({
  "src/api.js"(exports2, module2) {
    var crypto = require("node:crypto");
    var nodeFs = require("node:fs");
    var nodePath = require("node:path");
    var nodeOs = require("node:os");
    function randomHexId(bytes = 8) {
      return "0x" + crypto.randomBytes(bytes).toString("hex");
    }
    function nowMicros() {
      return BigInt(Date.now()) * 1000n;
    }
    function getClaudeCodeProjectId() {
      const name = "Claude Code";
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i) & 65535;
      }
      return hash || 1;
    }
    var CLAUDE_CODE_PROJECT_ID = getClaudeCodeProjectId();
    var AgentReplayAPI2 = class {
      #endpoint;
      #tenantId;
      #projectId;
      #timeout;
      #currentTraceId;
      #currentSessionId;
      #projectInitialized;
      constructor(config) {
        this.#endpoint = String(config.serverUrl || "http://localhost:47100").replace(/\/+$/, "");
        this.#tenantId = Number(config.tenantId || 1);
        this.#projectId = null;
        this.#timeout = config.timeout || 3e4;
        this.#currentTraceId = randomHexId(16);
        this.#currentSessionId = process.env.CLAUDE_SESSION_ID || randomHexId(8);
        this.#projectInitialized = false;
      }
      get baseUrl() {
        return this.#endpoint;
      }
      get traceId() {
        return this.#currentTraceId;
      }
      get projectId() {
        return this.#projectId;
      }
      // -------------------------------------------------------------------------
      // Project Management - Use deterministic "Claude Code" project ID
      // -------------------------------------------------------------------------
      async ensureProject() {
        if (this.#projectInitialized && this.#projectId) {
          return this.#projectId;
        }
        this.#projectId = CLAUDE_CODE_PROJECT_ID;
        this.#projectInitialized = true;
        this.#registerProjectIfNeeded().catch(() => {
        });
        return this.#projectId;
      }
      async #registerProjectIfNeeded() {
        try {
          const res = await this.#callRaw("GET", "/api/v1/projects");
          const projects = res.projects || [];
          const existing = projects.find(
            (p) => Number(p.project_id) === CLAUDE_CODE_PROJECT_ID || p.name === "Claude Code"
          );
          if (!existing) {
            await this.#callRaw("POST", "/api/v1/projects", {
              name: "Claude Code",
              description: "Claude Code coding sessions"
            });
          }
        } catch (e) {
        }
      }
      // -------------------------------------------------------------------------
      // Health
      // -------------------------------------------------------------------------
      async ping() {
        try {
          await this.#callRaw("GET", "/api/v1/health");
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
      // -------------------------------------------------------------------------
      // Tracing API - Using proper span format
      // -------------------------------------------------------------------------
      async sendSpan(name, attributes = {}, parentSpanId = null, startTime = null, endTime = null) {
        await this.ensureProject();
        const spanId = randomHexId(8);
        const now = nowMicros();
        const span = {
          span_id: spanId,
          trace_id: this.#currentTraceId,
          parent_span_id: parentSpanId,
          name,
          start_time: Number(startTime || now),
          end_time: endTime ? Number(endTime) : Number(now + 1000n),
          attributes: {
            // Use exact attribute names the server expects
            "agent_id": "claude-code",
            "session_id": this.#currentSessionId,
            "tenant_id": String(this.#tenantId),
            "project_id": String(this.#projectId),
            ...Object.fromEntries(
              Object.entries(attributes).map(([k, v]) => [k, String(v)])
            )
          }
        };
        const body = { spans: [span] };
        try {
          await this.#call("POST", "/api/v1/traces", body);
          return spanId;
        } catch (e) {
          console.error(`[AgentReplay] Trace send failed: ${e.message}`);
          return null;
        }
      }
      async sendRootSpan(workspace, project) {
        return this.sendSpan("session.start", {
          "event.type": "session_start",
          "workspace.path": workspace || "",
          "project.name": project || ""
        });
      }
      async sendToolSpan(toolName, input, output, durationMs = null, parentSpanId = null) {
        const startTime = nowMicros();
        const endTime = durationMs ? startTime + BigInt(durationMs * 1e3) : startTime + 1000n;
        return this.sendSpan(`tool.${toolName}`, {
          "tool.name": toolName,
          "tool.input": this.#truncate(JSON.stringify(input), 2e3),
          "tool.output": this.#truncate(JSON.stringify(output), 2e3),
          "tool.duration_ms": String(durationMs || 0)
        }, parentSpanId, startTime, endTime);
      }
      async sendEndSpan(reason = "normal", parentSpanId = null) {
        return this.sendSpan("session.end", {
          "event.type": "session_end",
          "session.end_reason": reason
        }, parentSpanId);
      }
      // -------------------------------------------------------------------------
      // Memory API
      // -------------------------------------------------------------------------
      async storeMemory(content, collection, meta = {}, docId = null) {
        const body = {
          content,
          collection,
          metadata: { origin: "claude-plugin", ...meta }
        };
        if (docId) body.custom_id = docId;
        const res = await this.#call("POST", "/api/v1/memory/ingest", body);
        return {
          docId: res.document_id,
          stored: res.success === true,
          chunks: res.chunks_created || 0
        };
      }
      async searchMemory(query, collection, limit = 10) {
        const body = { query, collection, limit, min_score: 0 };
        const res = await this.#call("POST", "/api/v1/memory/retrieve", body);
        const items = Array.isArray(res.results) ? res.results : [];
        return {
          matches: items.map((r) => ({
            docId: r.document_id,
            text: r.content || "",
            score: r.score,
            meta: r.metadata
          })),
          total: res.total_results || items.length
        };
      }
      async getProfile(collection, query = "") {
        const search = await this.searchMemory(query, collection, 20);
        const prefs = [];
        const ctx = [];
        for (const m of search.matches) {
          const kind = m.meta?.type || m.meta?.kind;
          if (kind === "preference" || kind === "convention") {
            prefs.push(m.text);
          } else {
            ctx.push(m.text);
          }
        }
        return {
          preferences: prefs.slice(0, 10),
          context: ctx.slice(0, 10),
          search
        };
      }
      // -------------------------------------------------------------------------
      // Internals
      // -------------------------------------------------------------------------
      // Raw call without project_id (used for project listing/creation)
      async #callRaw(method, path, body = null) {
        const url = `${this.#endpoint}${path}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.#timeout);
        try {
          const opts = {
            method,
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-ID": String(this.#tenantId)
            },
            signal: ctrl.signal
          };
          if (body) opts.body = JSON.stringify(body);
          const res = await fetch(url, opts);
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
          }
          return res.json();
        } finally {
          clearTimeout(timer);
        }
      }
      // Call with project_id header
      async #call(method, path, body = null) {
        if (!this.#projectId) {
          await this.ensureProject();
        }
        const url = `${this.#endpoint}${path}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.#timeout);
        try {
          const opts = {
            method,
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-ID": String(this.#tenantId),
              "X-Project-ID": String(this.#projectId)
            },
            signal: ctrl.signal
          };
          if (body) opts.body = JSON.stringify(body);
          const res = await fetch(url, opts);
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
          }
          return res.json();
        } finally {
          clearTimeout(timer);
        }
      }
      #truncate(s, max) {
        return s && s.length > max ? s.slice(0, max) + "..." : s;
      }
    };
    module2.exports = { AgentReplayAPI: AgentReplayAPI2 };
  }
});

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
    function log(cfg, tag, data = null) {
      if (!cfg.verbose) return;
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      const msg = data ? `[${ts}] ${tag}: ${JSON.stringify(data)}` : `[${ts}] ${tag}`;
      process.stderr.write(msg + "\n");
    }
    function computeWorkspaceId2(dirPath) {
      if (!dirPath) return "ws_default";
      const abs = nodePath.resolve(dirPath);
      const hash = nodeCrypto.createHash("sha1").update(abs).digest("hex").slice(0, 12);
      const name = nodePath.basename(abs).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
      return name ? `ws_${name}_${hash}` : `ws_${hash}`;
    }
    function extractProjectName2(dirPath) {
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
    function parseStdin() {
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
    function respond(payload) {
      process.stdout.write(JSON.stringify(payload) + "\n");
    }
    function done(additionalContext = null) {
      if (additionalContext) {
        respond({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } });
      } else {
        respond({ continue: true, suppressOutput: true });
      }
    }
    module2.exports = {
      loadConfig: loadConfig2,
      log,
      computeWorkspaceId: computeWorkspaceId2,
      extractProjectName: extractProjectName2,
      readState,
      writeState,
      parseStdin,
      respond,
      done,
      CONFIG_DIR,
      STATE_DIR
    };
  }
});

// src/cli/search-memory.js
var { AgentReplayAPI } = require_api();
var { loadConfig, computeWorkspaceId, extractProjectName } = require_common();
(async () => {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.log('Usage: search-memory "your query"');
    console.log('Example: search-memory "authentication setup"');
    return;
  }
  const cfg = loadConfig();
  const cwd = process.cwd();
  const wsId = computeWorkspaceId(cwd);
  const projectName = extractProjectName(cwd);
  const api = new AgentReplayAPI(cfg);
  const health = await api.ping();
  if (!health.ok) {
    console.log(`Cannot reach Agent Replay at ${cfg.serverUrl}`);
    console.log("Start the Agent Replay server to search memories.");
    return;
  }
  try {
    const profile = await api.getProfile(wsId, query);
    console.log(`
# Search: "${query}"`);
    console.log(`# Project: ${projectName}
`);
    if (profile.preferences?.length > 0) {
      console.log("## Preferences");
      profile.preferences.forEach((p) => console.log(`  \u2022 ${p}`));
      console.log("");
    }
    if (profile.context?.length > 0) {
      console.log("## Context");
      profile.context.forEach((c) => console.log(`  \u2022 ${c}`));
      console.log("");
    }
    const matches = profile.search?.matches || [];
    if (matches.length > 0) {
      console.log("## Matches");
      matches.slice(0, 8).forEach((m, i) => {
        const pct = m.score != null ? Math.round(m.score * 100) : 0;
        const preview = (m.text || "").slice(0, 300);
        console.log(`
[${i + 1}] ${pct}% match`);
        console.log(preview);
      });
    }
    if (!profile.preferences?.length && !profile.context?.length && !matches.length) {
      console.log("No matches found.");
      console.log("Memories build up as you work in this project.");
    }
  } catch (err) {
    console.log(`Search failed: ${err.message}`);
  }
})();
