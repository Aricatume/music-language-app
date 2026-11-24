/* Static Serverless Storage + Ebbinghaus Review + L01-L04 Telemetry
 * Uses Telegram.WebApp.CloudStorage strictly behind isVersionAtLeast("6.9") guard,
 * with instant synchronous localStorage fallback (zero console warnings outside TG).
 * UMD module (runs in browser & Node.js unit tests).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.MusicStorage = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const KEYS = {
    PROFILE: "ml_v1_profile",
    PROGRESS: "ml_v1_progress",
    EBBINGHAUS: "ml_v1_ebbinghaus",
    EBB_SHARD_0: "ml_v1_ebb_0",
    EBB_SHARD_1: "ml_v1_ebb_1",
    TELEMETRY: "ml_v1_telemetry",
  };

  function utf8ByteLength(str) {
    const s = String(str || "");
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(s).length;
    }
    try {
      return unescape(encodeURIComponent(s)).length;
    } catch (_) {
      return s.length * 2;
    }
  }

  // Adaptive Ebbinghaus intervals in days (non-punitive, M03 + M05)
  const EBB_INTERVALS_DAYS = [1, 3, 7, 14, 30];
  const MAX_TELEMETRY_EVENTS = 60;

  function defaultProfile() {
    return {
      timbre: "guitar",
      guitarTuning: "standard_6",
      tunerDamping: "slow",
      droneDefault: false,
      lastAtomId: "M001",
      lastActId: "A1",
      transpose: 0,
      capo: 0,
      proInterestClicked: false,
      tourDone: false,
      sandboxUnlocked: false,
      seenMilestones: [],
      sessionRootPc: 0,
      sessionModeId: "minor",
      updatedAt: 0,
    };
  }

  function defaultProgress() {
    return {
      completedAtoms: [],
      heardShifts: {},
      earTotal: 0,
      earCorrect: 0,
      savedScenes: [],
      totalSessions: 0,
    };
  }

  function defaultTelemetry() {
    return {
      txIds: [],       // L01 idempotency ring
      events: [],      // L02/L03/L04 structured records
      l04Clicks: 0,
    };
  }

  function supportsTgCloud(tg) {
    try {
      return !!(
        tg &&
        tg.CloudStorage &&
        typeof tg.CloudStorage.getItem === "function" &&
        typeof tg.CloudStorage.setItem === "function" &&
        typeof tg.isVersionAtLeast === "function" &&
        tg.isVersionAtLeast("6.9")
      );
    } catch (_) {
      return false;
    }
  }

  class MusicStore {
    constructor(opts) {
      const o = opts || {};
      this.tg = o.tg !== undefined ? o.tg : (root.Telegram && root.Telegram.WebApp) || null;
      this.ls = o.localStorage !== undefined ? o.localStorage : (typeof root.localStorage !== "undefined" ? root.localStorage : null);
      this.useCloud = supportsTgCloud(this.tg);
      this.nowFn = typeof o.nowFn === "function" ? o.nowFn : () => Date.now();

      this.profile = defaultProfile();
      this.progress = defaultProgress();
      this.ebbinghaus = {}; // { M001: { stage: 0..4, dueAt: epochMs, lastAt: epochMs } }
      this.telemetry = defaultTelemetry();
    }

    _readLocal(key) {
      if (!this.ls) return null;
      try {
        const raw = this.ls.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    _writeLocal(key, val) {
      if (!this.ls) return;
      try {
        this.ls.setItem(key, JSON.stringify(val));
      } catch (_) {}
    }

    _readCloud(key) {
      if (!this.useCloud) return Promise.resolve(null);
      return new Promise((resolve) => {
        try {
          this.tg.CloudStorage.getItem(key, (err, val) => {
            if (err || !val) return resolve(null);
            try {
              resolve(JSON.parse(val));
            } catch (_) {
              resolve(null);
            }
          });
        } catch (_) {
          resolve(null);
        }
      });
    }

    _writeCloud(key, val) {
      if (!this.useCloud) return Promise.resolve();
      if (key === KEYS.TELEMETRY) return Promise.resolve(); // Keep telemetry strictly local so cloud quota stays clean
      if (key === KEYS.EBBINGHAUS) {
        return this._writeCloudEbbinghausSharded(val);
      }
      let payload = val;
      let encoded = JSON.stringify(payload);
      if (utf8ByteLength(encoded) > 3950 && key === KEYS.PROGRESS && payload && typeof payload === "object") {
        // Trim non-essential heardShifts map first so completedAtoms & savedScenes always fit in 4096 UTF-8 bytes
        payload = Object.assign({}, payload, { heardShifts: {} });
        encoded = JSON.stringify(payload);
      }
      if (utf8ByteLength(encoded) > 3950) return Promise.resolve();
      return new Promise((resolve) => {
        try {
          this.tg.CloudStorage.setItem(key, encoded, () => resolve());
        } catch (_) {
          resolve();
        }
      });
    }

    _writeCloudEbbinghausSharded(ebbMap) {
      if (!this.useCloud) return Promise.resolve();
      // Compact representation [stage, lastSec, dueSec] split into 2 shards (easily holds all 216 atoms under 4KB UTF-8!)
      const entries = Object.entries(ebbMap || {});
      const s0 = {};
      const s1 = {};
      entries.forEach(([k, v], idx) => {
        if (!v) return;
        const compact = [v.stage || 0, Math.floor((v.lastAt || 0) / 1000), Math.floor((v.dueAt || 0) / 1000)];
        if (idx % 2 === 0) s0[k] = compact;
        else s1[k] = compact;
      });
      const writeOne = (k, obj) => {
        const enc = JSON.stringify(obj);
        if (utf8ByteLength(enc) > 3950) return Promise.resolve();
        return new Promise((resolve) => {
          try { this.tg.CloudStorage.setItem(k, enc, () => resolve()); } catch (_) { resolve(); }
        });
      };
      return Promise.all([writeOne(KEYS.EBB_SHARD_0, s0), writeOne(KEYS.EBB_SHARD_1, s1)]);
    }

    _expandEbbMap(raw) {
      const out = {};
      if (!raw || typeof raw !== "object") return out;
      for (const [k, v] of Object.entries(raw)) {
        if (Array.isArray(v) && v.length >= 3) {
          out[k] = { stage: v[0] || 0, lastAt: (v[1] || 0) * 1000, dueAt: (v[2] || 0) * 1000 };
        } else if (v && typeof v === "object") {
          out[k] = v;
        }
      }
      return out;
    }

    _mergeProgress(localP, cloudP) {
      const a = Object.assign(defaultProgress(), localP || {});
      const b = Object.assign(defaultProgress(), cloudP || {});
      const atoms = Array.from(new Set([...(a.completedAtoms || []), ...(b.completedAtoms || [])]));
      const heardShifts = Object.assign({}, b.heardShifts || {}, a.heardShifts || {});
      const sceneByKey = new Map();
      [...(b.savedScenes || []), ...(a.savedScenes || [])].forEach((sc) => {
        if (!sc || !sc.key) return;
        const prev = sceneByKey.get(sc.key);
        if (!prev || (sc.ts || 0) >= (prev.ts || 0)) sceneByKey.set(sc.key, sc);
      });
      const savedScenes = Array.from(sceneByKey.values()).sort((x, y) => (y.ts || 0) - (x.ts || 0)).slice(0, 6);
      return {
        completedAtoms: atoms,
        heardShifts,
        earTotal: Math.max(a.earTotal || 0, b.earTotal || 0),
        earCorrect: Math.max(a.earCorrect || 0, b.earCorrect || 0),
        savedScenes,
        totalSessions: Math.max(a.totalSessions || 0, b.totalSessions || 0),
      };
    }

    _mergeEbbinghaus(localE, cloudE) {
      const merged = Object.assign({}, this._expandEbbMap(cloudE));
      const loc = this._expandEbbMap(localE);
      for (const [k, rec] of Object.entries(loc)) {
        const prev = merged[k];
        if (!prev || (rec.lastAt || 0) >= (prev.lastAt || 0)) {
          merged[k] = rec;
        }
      }
      return merged;
    }

    async init() {
      const locProf = this._readLocal(KEYS.PROFILE);
      const cldProf = await this._readCloud(KEYS.PROFILE);
      const chosenProf = (locProf && cldProf)
        ? ((locProf.updatedAt || 0) >= (cldProf.updatedAt || 0) ? Object.assign({}, cldProf, locProf) : Object.assign({}, locProf, cldProf))
        : (locProf || cldProf || {});
      this.profile = Object.assign(defaultProfile(), chosenProf);

      const locProg = this._readLocal(KEYS.PROGRESS);
      const cldProg = await this._readCloud(KEYS.PROGRESS);
      this.progress = this._mergeProgress(locProg, cldProg);

      const locEbb = this._readLocal(KEYS.EBBINGHAUS);
      const [cldEbbLegacy, cldEbb0, cldEbb1] = await Promise.all([
        this._readCloud(KEYS.EBBINGHAUS),
        this._readCloud(KEYS.EBB_SHARD_0),
        this._readCloud(KEYS.EBB_SHARD_1),
      ]);
      const cloudEbb = Object.assign({}, this._expandEbbMap(cldEbbLegacy), this._expandEbbMap(cldEbb0), this._expandEbbMap(cldEbb1));
      this.ebbinghaus = this._mergeEbbinghaus(locEbb, cloudEbb);

      this.telemetry = Object.assign(defaultTelemetry(), this._readLocal(KEYS.TELEMETRY) || {});
      return this;
    }

    _persist(key, val) {
      this._writeLocal(key, val);
      this._writeCloud(key, val);
    }

    updateProfile(patch) {
      Object.assign(this.profile, patch || {}, { updatedAt: this.nowFn() });
      this._persist(KEYS.PROFILE, this.profile);
      return this.profile;
    }

    /* Record L01-L04 event with L01 idempotency key deduplication */
    logEvent(layer, action, payload, txId) {
      const key = txId || (layer + ":" + action + ":" + this.nowFn() + ":" + Math.random().toString(36).slice(2, 6));
      if (txId && this.telemetry.txIds.includes(txId)) {
        return { status: "DEDUP_SKIP", txId };
      }
      this.telemetry.txIds.push(key);
      if (this.telemetry.txIds.length > 100) {
        this.telemetry.txIds = this.telemetry.txIds.slice(-100);
      }
      const entry = {
        ts: this.nowFn(),
        layer,
        action,
        data: payload || {},
      };
      this.telemetry.events.push(entry);
      if (this.telemetry.events.length > MAX_TELEMETRY_EVENTS) {
        this.telemetry.events = this.telemetry.events.slice(-MAX_TELEMETRY_EVENTS);
      }
      if (layer === "L04") {
        this.telemetry.l04Clicks += 1;
      }
      this._persist(KEYS.TELEMETRY, this.telemetry);
      return { status: "RECORDED", entry };
    }

    /* Mark atom completed + schedule Ebbinghaus review + log L02 & L03 (strict L01 dedup BEFORE mutation!) */
    completeAtom(atomId, semanticTag, txId) {
      if (txId && this.telemetry.txIds.includes(txId)) {
        return this.ebbinghaus[atomId] || null;
      }
      const now = this.nowFn();
      if (!this.progress.completedAtoms.includes(atomId)) {
        this.progress.completedAtoms.push(atomId);
      }
      this.progress.totalSessions += 1;
      if (semanticTag) {
        this.progress.heardShifts[atomId] = semanticTag;
      }
      this._persist(KEYS.PROGRESS, this.progress);

      const prev = this.ebbinghaus[atomId];
      const nextStage = semanticTag === "need_repeat"
        ? 0
        : prev
          ? Math.min(EBB_INTERVALS_DAYS.length - 1, (prev.stage || 0) + 1)
          : 0;
      const days = EBB_INTERVALS_DAYS[nextStage];
      this.ebbinghaus[atomId] = {
        stage: nextStage,
        lastAt: now,
        dueAt: now + days * 24 * 60 * 60 * 1000,
      };
      this._persist(KEYS.EBBINGHAUS, this.ebbinghaus);

      this.logEvent("L02", "atom_complete", { atomId, stage: nextStage }, txId);
      if (semanticTag) {
        this.logEvent("L03", "semantic_feedback", { atomId, tag: semanticTag });
      }
      return this.ebbinghaus[atomId];
    }

    getDueReviewIds(limit) {
      const now = this.nowFn();
      const due = [];
      for (const [atomId, rec] of Object.entries(this.ebbinghaus || {})) {
        if (rec && typeof rec.dueAt === "number" && rec.dueAt <= now) {
          due.push({ atomId, dueAt: rec.dueAt, stage: rec.stage || 0 });
        }
      }
      due.sort((a, b) => a.dueAt - b.dueAt);
      return due.slice(0, limit || 6).map((d) => d.atomId);
    }

    recordEarAttempt(mode, correct) {
      this.progress.earTotal += 1;
      if (correct) this.progress.earCorrect += 1;
      this._persist(KEYS.PROGRESS, this.progress);
      this.logEvent("L02", "ear_attempt", { mode, correct: !!correct });
      return {
        total: this.progress.earTotal,
        correct: this.progress.earCorrect,
        accuracy: this.progress.earTotal ? Math.round((this.progress.earCorrect / this.progress.earTotal) * 100) : 0,
      };
    }

    saveScene(sceneIds, density, keyPc) {
      const clean = (sceneIds || []).slice(0, 6);
      if (clean.length < 2) return this.progress.savedScenes;
      const safeKey = typeof keyPc === "number" ? ((Math.round(keyPc) % 12) + 12) % 12 : 0;
      const key = clean.join("+") + "@" + (density || "acoustic") + "@" + safeKey;
      this.progress.savedScenes = [
        { key, ids: clean, density: density || "acoustic", keyPc: safeKey, ts: this.nowFn() },
        ...(this.progress.savedScenes || []).filter((s) => s.key !== key),
      ].slice(0, 6);
      this._persist(KEYS.PROGRESS, this.progress);
      this.logEvent("L02", "scene_saved", { ids: clean, density: density || "acoustic", keyPc: safeKey });
      return this.progress.savedScenes;
    }

    markTourDone(completed) {
      this.profile.tourDone = true;
      this._persist(KEYS.PROFILE, this.profile);
      this.logEvent("L02", completed ? "tour_completed" : "tour_skipped", {});
    }

    /* NFS Underground Progressive Unlock Level (0..3)
     * 0: Start (Путь + 60 чувств + Камертон)
     * 1: 1+ lesson done -> Слух unlocked
     * 2: 2+ lessons done -> Ударные + Круг аккордов unlocked
     * 3: 3+ lessons done OR sandboxUnlocked -> Full Studio unlocked
     */
    getUnlockLevel() {
      if (this.profile.sandboxUnlocked) return 3;
      const done = (this.progress.completedAtoms || []).length;
      return Math.min(3, done);
    }

    isUnlocked(featureKey) {
      const lvl = this.getUnlockLevel();
      if (featureKey === "route" || featureKey === "atlas" || featureKey === "tuner" || featureKey === "rhythm") return true;
      if (featureKey === "ear") return lvl >= 1;
      if (featureKey === "drums" || featureKey === "circle") return lvl >= 2;
      if (featureKey === "sphere" || featureKey === "guitar" || featureKey === "scene" || featureKey === "catalog") return lvl >= 3;
      return true;
    }

    setSandboxUnlocked(flag) {
      this.profile.sandboxUnlocked = !!flag;
      this.profile.updatedAt = this.nowFn();
      this._persist(KEYS.PROFILE, this.profile);
      this.logEvent("L02", flag ? "sandbox_unlocked" : "guided_mode_enabled", {});
    }

    markMilestoneSeen(level) {
      const arr = Array.isArray(this.profile.seenMilestones) ? this.profile.seenMilestones.slice() : [];
      if (!arr.includes(level)) {
        arr.push(level);
        this.profile.seenMilestones = arr;
        this.profile.updatedAt = this.nowFn();
        this._persist(KEYS.PROFILE, this.profile);
      }
    }

    recordProInterest(featureTag) {
      this.profile.proInterestClicked = true;
      this._persist(KEYS.PROFILE, this.profile);
      return this.logEvent("L04", "pro_interest", { feature: featureTag || "deep_breakdowns" });
    }

    exportSnapshot() {
      return {
        exportedAt: new Date(this.nowFn()).toISOString(),
        storageBackend: this.useCloud ? "telegram_cloud_storage" : "local_storage",
        profile: this.profile,
        progress: this.progress,
        ebbinghaus: this.ebbinghaus,
        telemetryCount: (this.telemetry.events || []).length,
        l04Clicks: this.telemetry.l04Clicks || 0,
      };
    }

    resetAll() {
      this.profile = defaultProfile();
      this.progress = defaultProgress();
      this.ebbinghaus = {};
      this.telemetry = defaultTelemetry();
      for (const k of Object.values(KEYS)) {
        if (this.ls) {
          try { this.ls.removeItem(k); } catch (_) {}
        }
        if (this.useCloud) {
          try { this.tg.CloudStorage.removeItem(k, () => {}); } catch (_) {}
        }
      }
    }
  }

  return {
    KEYS,
    EBB_INTERVALS_DAYS,
    utf8ByteLength,
    supportsTgCloud,
    MusicStore,
  };
});
