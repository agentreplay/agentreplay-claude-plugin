var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/api.js
var require_api = __commonJS({
  "src/api.js"(exports2, module2) {
    var SpanType = Object.freeze({
      Root: 0,
      Planning: 1,
      Reasoning: 2,
      ToolCall: 3,
      ToolResponse: 4,
      Synthesis: 5,
      Response: 6,
      Error: 7,
      Retrieval: 8,
      Embedding: 9,
      HttpCall: 10,
      Database: 11,
      Function: 12,
      Custom: 255
    });
    var AgentReplayAPI2 = class {
      #endpoint;
      #tenantId;
      #projectId;
      #timeout;
      constructor(config) {
        this.#endpoint = String(config.serverUrl || "http://localhost:47100").replace(/\/+$/, "");
        this.#tenantId = Number(config.tenantId || 1);
        this.#projectId = Number(config.projectId || 1);
        this.#timeout = config.timeout || 3e4;
      }
      get baseUrl() {
        return this.#endpoint;
      }
      // -------------------------------------------------------------------------
      // Health
      // -------------------------------------------------------------------------
      async ping() {
        try {
          await this.#call("GET", "/api/v1/health");
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
      // -------------------------------------------------------------------------
      // Tracing API
      // -------------------------------------------------------------------------
      async sendTrace(spanType, meta = {}, parentEdgeId = null, tokenCount = null) {
        const body = {
          tenant_id: this.#tenantId,
          project_id: this.#projectId,
          agent_id: this.#hashStr("claude-code"),
          session_id: this.#getSessionId(),
          span_type: spanType
        };
        if (parentEdgeId) body.parent_edge_id = parentEdgeId;
        if (tokenCount) body.token_count = tokenCount;
        if (meta && Object.keys(meta).length > 0) body.metadata = meta;
        return this.#call("POST", "/api/v1/traces", body);
      }
      async sendToolTrace(toolName, input, output, durationMs = null, parentEdgeId = null) {
        const body = {
          tenant_id: this.#tenantId,
          project_id: this.#projectId,
          agent_id: this.#hashStr("claude-code"),
          session_id: this.#getSessionId(),
          span_type: SpanType.ToolCall,
          metadata: {
            tool_name: toolName,
            tool_input: this.#truncate(JSON.stringify(input), 2e3),
            tool_output: this.#truncate(JSON.stringify(output), 2e3)
          }
        };
        if (durationMs != null) body.duration_ms = durationMs;
        if (parentEdgeId) body.parent_edge_id = parentEdgeId;
        return this.#call("POST", "/api/v1/traces", body);
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
      async #call(method, path, body = null) {
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
      #hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = (h << 5) - h + s.charCodeAt(i) | 0;
        }
        return Math.abs(h);
      }
      #getSessionId() {
        const key = process.env.CLAUDE_SESSION_ID || (/* @__PURE__ */ new Date()).toISOString().slice(0, 13);
        return this.#hashStr(key);
      }
      #truncate(s, max) {
        return s && s.length > max ? s.slice(0, max) + "..." : s;
      }
    };
    module2.exports = { AgentReplayAPI: AgentReplayAPI2, SpanType };
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

// src/cli/add-memory.js
var { AgentReplayAPI } = require_api();
var { loadConfig, computeWorkspaceId, extractProjectName } = require_common();
(async () => {
  const content = process.argv.slice(2).join(" ").trim();
  if (!content) {
    console.log('Usage: add-memory "content to store"');
    console.log('Example: add-memory "User prefers dark mode"');
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
    console.log("Start the Agent Replay server to store memories.");
    return;
  }
  try {
    const result = await api.storeMemory(content, wsId, {
      kind: "manual",
      project: projectName,
      when: (/* @__PURE__ */ new Date()).toISOString()
    });
    console.log(`Stored in: ${projectName}`);
    console.log(`Document: ${result.docId}`);
    console.log("Data saved locally.");
  } catch (err) {
    console.log(`Store failed: ${err.message}`);
  }
})();
