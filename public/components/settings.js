/**
 * 模型设置（照抄 appUIRefiner Settings.tsx，纯 JavaScript 版本）
 * - 15 家预置 Provider；每家：启停 / baseUrl / API Key / 模型勾选 / 默认模型 / 真实验证
 * - Provider 卡片可拖拽排序（localStorage 持久化，appUIRefiner 同款机制）
 * - 已勾选模型构成回退链，可拖拽排序；「设默认」= 置顶链首（appUIRefiner 同款语义）
 */
import { t, apiFetch } from "../i18n.js";

(function() {
  const PROVIDER_ORDER_KEY = "agent-evaluator-provider-order";
  const FORMS_DRAFT_KEY = "agent-evaluator-forms-draft";

  function loadProviderOrder() {
    try {
      const saved = localStorage.getItem(PROVIDER_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  }

  function saveProviderOrder(order) {
    try {
      localStorage.setItem(PROVIDER_ORDER_KEY, JSON.stringify(order));
    } catch { /* ignore */ }
  }

  function loadFormsDraft() {
    try {
      const saved = localStorage.getItem(FORMS_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch { /* ignore */ }
    return null;
  }

  function saveFormsDraft(forms) {
    try {
      localStorage.setItem(FORMS_DRAFT_KEY, JSON.stringify(forms));
    } catch { /* ignore */ }
  }

  class SettingsModal {
    constructor() {
      this.modal = document.getElementById("settingsModal");
      this.openBtn = document.getElementById("openSettingsBtn");
      this.closeBtn = document.getElementById("closeSettingsBtn");
      this.saveBtn = document.getElementById("saveSettingsBtn");
      this.resetBtn = document.getElementById("resetSettingsBtn");
      this.loadModelsBtn = document.getElementById("loadModelsBtn");
      this.status = document.getElementById("saveStatus");
      this.providerList = this.modal.querySelector(".provider-list");
      
      this.presets = [];
      this.forms = {};
      this.liveModels = {};
      this.verifies = {};
      this.loadingModel = null;
      this.toast = null;
      this.saving = false;
      this.loaded = false;
      this.autoSavedAt = null;
      this.providerOrder = loadProviderOrder();
      this.modelQuery = {};
      this.catalog = {};
      
      // 拖拽状态（appUIRefiner 同款 refs 方案）
      this.dragProviderItem = null;
      this.dragProviderOver = null;
      this.dragChainItem = null;
      this.dragChainOver = null;
      this.dragOverProviderIdx = null;
      this.dragOverChainIdx = null;
      
      // 折叠状态（保持用户手动折叠/展开的状态）
      this.openStates = {};
      
      // 自动保存定时器
      this.autoSaveTimer = null;
      
      this.init();
    }
    
    init() {
      this.openBtn.addEventListener("click", () => this.open());
      this.closeBtn.addEventListener("click", () => this.close());
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.close();
      });
      
      this.saveBtn.addEventListener("click", () => this.save());
      this.resetBtn.addEventListener("click", () => this.reset());
      this.loadModelsBtn.addEventListener("click", () => this.loadAllModels());
      
      // 加载模型目录
      this.loadCatalog();
    }
    
    async loadCatalog() {
      try {
        const res = await apiFetch("/api/models").then(r => r.json());
        this.catalog = res.catalog || {};
      } catch {
        this.catalog = {};
      }
    }
    
    async open() {
      this.modal.hidden = false;
      this.status.textContent = "";
      
      try {
        const [presetRes, savedRes] = await Promise.all([
          apiFetch("/api/providers/presets").then(r => r.json()),
          apiFetch("/api/settings").then(r => r.json()),
        ]);
        
        this.presets = presetRes.presets || [];
        const settings = savedRes.settings || {};
        
        // 初始化表单
        const next = {};
        for (const p of this.presets) {
          const conf = settings[`provider_${p.id}`] || {};
          next[p.id] = {
            enabled: Boolean(conf.enabled),
            baseUrl: conf.baseUrl || p.baseUrl,
            apiKey: conf.apiKey || "",
            modelIds: conf.modelIds || [],
            defaultModelId: conf.defaultModelId || "",
          };
        }
        
        // 本机草稿覆盖服务端配置
        const draft = loadFormsDraft();
        if (draft) {
          for (const p of this.presets) {
            if (draft[p.id]) next[p.id] = { ...next[p.id], ...draft[p.id] };
          }
        }
        
        this.forms = next;
        this.loaded = true;
        this.renderProviderList();
      } catch (e) {
        this.showToast(false, `${t('saveError')}${e.message}`);
        this.loaded = true;
      }
    }
    
    close() {
      this.modal.hidden = true;
    }
    
    renderProviderList() {
      const sortedPresets = this.getSortedPresets();
      
      // 保存当前折叠状态
      this.providerList.querySelectorAll("details.provider-card").forEach(el => {
        this.openStates[el.dataset.providerId] = el.open;
      });
      
      this.providerList.innerHTML = "";
      
      for (let idx = 0; idx < sortedPresets.length; idx++) {
        const p = sortedPresets[idx];
        const f = this.forms[p.id];
        if (!f) continue;
        
        const models = this.getSelectableModels(p.id);
        const v = this.verifies[p.id];
        const chain = f.modelIds;
        
        const details = document.createElement("details");
        details.className = "provider-card";
        details.dataset.providerId = p.id;
        details.dataset.index = idx;
        
        // 恢复折叠状态：优先使用用户手动设置的状态，否则使用 enabled 状态
        if (this.openStates[p.id] !== undefined) {
          details.open = this.openStates[p.id];
        } else {
          details.open = f.enabled;
          this.openStates[p.id] = f.enabled;
        }
        
        details.innerHTML = `
          <summary draggable="true" class="${this.dragOverProviderIdx === idx ? "drag-over" : ""}">
            <span class="drag-handle" title="${t('dragCardTitle')}">⠿</span>
            <label onclick="event.stopPropagation()">
              <input type="checkbox" ${f.enabled ? "checked" : ""} />
            </label>
            <b>${p.displayName}</b>
            <span class="provider-desc">${p.desc}</span>
            ${v ? `<span class="verify-badge ${v.ok ? "ok" : "err"}">${v.ok ? t('verified') : t('verifyError')}</span>` : ""}
          </summary>
          <div class="provider-body">
            <label class="row">
              <span>${t('baseUrl')}</span>
              <input type="text" data-field="baseUrl" value="${f.baseUrl || ""}" />
            </label>
            <label class="row">
              <span>${t('apiKey')}</span>
              <input type="password" data-field="apiKey" placeholder="${t('apiKeyPlaceholder')}" value="${f.apiKey || ""}" />
            </label>
            <div class="row">
              <span>${t('optionalModels')}</span>
              <input class="model-search" placeholder="${t('modelSearch')}" value="${this.modelQuery[p.id] || ""}" />
              <button class="ghost small load-models-btn" ${this.loadingModel === p.id ? "disabled" : ""}>
                ${this.loadingModel === p.id ? t('fetchingModels') : t('fetchModels')}
              </button>
            </div>
            <div class="model-grid">
              ${models.length === 0 ? `<span class="hint">${t('noModelDirectory')}</span>` : this.renderModelList(p.id, models, chain)}
            </div>
            ${models.length > 0 ? `<div class="model-count">${t('modelCount')} ${this.getFilteredModels(p.id).length} ${t('modelCountOf')} ${models.length} ${t('modelCountModels')}</div>` : ""}
            ${chain.length > 0 ? this.renderChainBox(p.id, chain, f) : ""}
            <div class="provider-actions">
              <button class="ghost small verify-btn">${t('verifyModel')}</button>
              ${v && !v.ok ? `<span class="verify-err">${v.error}</span>` : ""}
            </div>
          </div>
        `;
        
        this.providerList.appendChild(details);
        this.bindCardEvents(details, p.id, idx);
      }
    }
    
    renderModelList(pid, models, chain) {
      const filtered = this.getFilteredModels(pid);
      if (models.length > 0 && filtered.length === 0) {
        const q = (this.modelQuery[pid] || "").trim();
        return `<span class="hint">${t('noMatchingModels')}「${q}」${t('noMatchingModelsTry')} ${models.length} ${t('noMatchingModelsTryEnd')}</span>`;
      }
      
      return filtered.map(m => {
        const checked = chain.includes(m);
        const info = (this.catalog[pid] || []).find(x => x.id === m);
        return `
          <label class="model-item ${checked ? "checked" : ""}">
            <input type="checkbox" ${checked ? "checked" : ""} data-model="${m}" />
            <span class="model-id">${this.highlight(m, this.modelQuery[pid] || "")}</span>
            ${info?.supportsStructuredOutput ? `<span class="cap" title="${t('supportsSO')}">SO</span>` : ""}
            ${info?.supportsFunctionCalling ? `<span class="cap" title="${t('supportsFC')}">FC</span>` : ""}
            ${this.forms[pid].defaultModelId === m ? `<span class="cap default">${t('defaultModel')}</span>` : ""}
            ${checked && this.forms[pid].defaultModelId !== m ? `<button class="ghost small set-default-btn" data-model="${m}">${t('setDefault')}</button>` : ""}
          </label>
        `;
      }).join("");
    }
    
    renderChainBox(pid, chain, f) {
      return `
        <div class="chain-box">
          <div class="chain-title">
            ${t('fallbackChain')}（${chain.length} ${t('fallbackChainItems')}）${t('fallbackChainDesc')}
          </div>
          <ul class="chain-list">
            ${chain.map((m, ci) => `
              <li class="chain-item ${this.dragOverChainIdx === ci ? "drag-over" : ""}" data-index="${ci}" draggable="true">
                <span class="drag-handle" title="${t('dragChainTitle')}">⠿</span>
                <span class="chain-index">${ci + 1}</span>
                <span class="model-id">${m}</span>
                ${f.defaultModelId === m ? `<span class="cap default">${t('defaultModel')}</span>` : ""}
                ${f.defaultModelId !== m ? `<button class="ghost small set-default-btn" data-model="${m}">${t('setDefault')}</button>` : ""}
              </li>
            `).join("")}
          </ul>
        </div>
      `;
    }
    
    bindModelEvents(card, pid) {
      // 模型勾选
      card.querySelectorAll(".model-item input[type='checkbox']").forEach(input => {
        input.addEventListener("change", (e) => {
          this.toggleModel(pid, e.target.dataset.model);
        });
      });
      
      // 设默认
      card.querySelectorAll(".set-default-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleSelectDefault(pid, btn.dataset.model);
        });
      });
    }
    
    bindCardEvents(card, pid, idx) {
      // 拖拽排序
      const summary = card.querySelector("summary");
      summary.addEventListener("dragstart", (e) => {
        this.dragProviderItem = idx;
        e.dataTransfer.effectAllowed = "move";
      });
      summary.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.dragProviderOver = idx;
        // 更新拖拽高亮样式，不重新渲染整个列表
        this.providerList.querySelectorAll(".provider-card summary").forEach((s, i) => {
          s.classList.toggle("drag-over", i === idx);
        });
      });
      summary.addEventListener("dragend", () => {
        const from = this.dragProviderItem;
        const to = this.dragProviderOver;
        // 移除所有拖拽高亮
        this.providerList.querySelectorAll(".provider-card summary").forEach(s => {
          s.classList.remove("drag-over");
        });
        this.dragProviderItem = null;
        this.dragProviderOver = null;
        // 处理拖拽结果
        if (from !== null && to !== null && from !== to) {
          const newOrder = this.getSortedPresets().map(p => p.id);
          const [moved] = newOrder.splice(from, 1);
          if (moved !== undefined) newOrder.splice(to, 0, moved);
          this.providerOrder = newOrder;
          saveProviderOrder(this.providerOrder);
          this.renderProviderList();
        }
      });
      
      // 启停切换
      const toggle = card.querySelector("summary input[type='checkbox']");
      toggle.addEventListener("change", (e) => {
        e.stopPropagation();
        this.updateForm(pid, { enabled: e.target.checked });
      });
      
      // Base URL
      const baseUrlInput = card.querySelector('[data-field="baseUrl"]');
      baseUrlInput.addEventListener("input", (e) => {
        this.updateForm(pid, { baseUrl: e.target.value });
      });
      
      // API Key
      const apiKeyInput = card.querySelector('[data-field="apiKey"]');
      apiKeyInput.addEventListener("input", (e) => {
        this.updateForm(pid, { apiKey: e.target.value });
      });
      
      // 模型搜索
      const searchInput = card.querySelector(".model-search");
      searchInput.addEventListener("input", (e) => {
        this.modelQuery[pid] = e.target.value;
        // 只更新模型列表，不重新渲染整个卡片
        const modelGrid = card.querySelector(".model-grid");
        const modelCount = card.querySelector(".model-count");
        const models = this.getSelectableModels(pid);
        const chain = this.forms[pid].modelIds;
        modelGrid.innerHTML = models.length === 0 
          ? `<span class="hint">${t('noModelDirHint')}</span>` 
          : this.renderModelList(pid, models, chain);
        if (modelCount) {
          modelCount.textContent = `${t('modelCount')} ${this.getFilteredModels(pid).length} ${t('modelCountOf')} ${models.length} ${t('modelCountModels')}`;
        }
        // 重新绑定模型勾选事件
        this.bindModelEvents(card, pid);
      });
      
      // 在线拉取
      const loadBtn = card.querySelector(".load-models-btn");
      loadBtn.addEventListener("click", () => this.fetchModels(pid));
      
      // 验证
      const verifyBtn = card.querySelector(".verify-btn");
      verifyBtn.addEventListener("click", () => this.verify(pid));
      
      // 模型勾选和设默认
      this.bindModelEvents(card, pid);
      
      // 回退链拖拽
      card.querySelectorAll(".chain-item").forEach(item => {
        const ci = parseInt(item.dataset.index);
        item.addEventListener("dragstart", (e) => {
          this.dragChainItem = { providerId: pid, index: ci };
          e.stopPropagation();
        });
        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dragChainOver = { providerId: pid, index: ci };
          // 更新拖拽高亮样式，不重新渲染整个列表
          card.querySelectorAll(".chain-item").forEach((li, i) => {
            li.classList.toggle("drag-over", i === ci);
          });
        });
        item.addEventListener("dragend", () => {
          this.dragChainItem = null;
          this.dragChainOver = null;
          // 移除所有拖拽高亮
          card.querySelectorAll(".chain-item").forEach(li => {
            li.classList.remove("drag-over");
          });
        });
        item.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleChainDrop(pid);
        });
      });
    }
    
    getSortedPresets() {
      const inOrder = this.providerOrder
        .map(id => this.presets.find(p => p.id === id))
        .filter(Boolean);
      const rest = this.presets.filter(p => !this.providerOrder.includes(p.id));
      return [...inOrder, ...rest];
    }
    
    getSelectableModels(pid) {
      const catalogModels = (this.catalog[pid] || []).map(m => m.id);
      const live = this.liveModels[pid] || [];
      return [...new Set([...catalogModels, ...live])];
    }
    
    getFilteredModels(pid) {
      const models = this.getSelectableModels(pid);
      const q = (this.modelQuery[pid] || "").trim().toLowerCase();
      if (!q) return models;
      return models.filter(m => m.toLowerCase().includes(q));
    }
    
    highlight(text, q) {
      if (!q) return text;
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return text;
      return `${text.slice(0, i)}<mark>${text.slice(i, i + q.length)}</mark>${text.slice(i + q.length)}`;
    }
    
    updateForm(pid, patch) {
      this.forms[pid] = { ...this.forms[pid], ...patch };
      saveFormsDraft(this.forms);
      this.renderProviderList();
      this.triggerAutoSave();
    }
    
    toggleModel(pid, modelId) {
      const f = this.forms[pid];
      const has = f.modelIds.includes(modelId);
      const modelIds = has ? f.modelIds.filter(m => m !== modelId) : [...f.modelIds, modelId];
      const defaultModelId = f.defaultModelId === modelId ? "" : f.defaultModelId;
      this.updateForm(pid, { modelIds, defaultModelId });
    }
    
    handleSelectDefault(pid, modelId) {
      const f = this.forms[pid];
      const rest = f.modelIds.filter(m => m !== modelId);
      this.updateForm(pid, { defaultModelId: modelId, modelIds: [modelId, ...rest] });
    }
    
    handleProviderDrop() {
      if (this.dragProviderItem === null || this.dragProviderOver === null || this.dragProviderItem === this.dragProviderOver) return;
      const newOrder = this.getSortedPresets().map(p => p.id);
      const [moved] = newOrder.splice(this.dragProviderItem, 1);
      if (moved !== undefined) newOrder.splice(this.dragProviderOver, 0, moved);
      this.providerOrder = newOrder;
      saveProviderOrder(this.providerOrder);
      this.renderProviderList();
    }
    
    handleChainDrop(pid) {
      const from = this.dragChainItem;
      const to = this.dragChainOver;
      this.dragChainItem = null;
      this.dragChainOver = null;
      this.dragOverChainIdx = null;
      if (!from || !to || from.providerId !== pid || from.index === to.index) return;
      
      const f = this.forms[pid];
      const list = [...f.modelIds];
      const [moved] = list.splice(from.index, 1);
      if (moved !== undefined) list.splice(to.index, 0, moved);
      this.updateForm(pid, { modelIds: list });
    }
    
    triggerAutoSave() {
      if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = setTimeout(() => {
        this.persist(true).catch((e) => {
          this.showToast(false, `${t('autoSaveError')}${e.message}`);
        });
      }, 800);
    }
    
    async fetchModels(pid) {
      const f = this.forms[pid];
      if (!f.apiKey) {
        this.showToast(false, t('keyRequired'));
        return;
      }
      
      this.loadingModel = pid;
      this.renderProviderList();
      
      try {
        const res = await apiFetch(`/api/providers/${pid}/models`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: f.apiKey, baseUrl: f.baseUrl || undefined }),
        }).then(r => r.json());
        
        if (res.ok) {
          this.liveModels[pid] = res.models || [];
          this.showToast(true, `${pid} ${t('modelsLoaded')} ${res.models.length} ${t('modelCountModels')}`);
        } else {
          this.showToast(false, `${t('modelsFailed')}${res.error || `HTTP ${res.status}`}`);
        }
      } catch (e) {
        this.showToast(false, `${t('modelsRequestFailed')}${e instanceof Error ? e.message : String(e)}${t('serverCheckHint')}`);
      } finally {
        this.loadingModel = null;
        this.renderProviderList();
      }
    }
    
    async verify(pid) {
      const f = this.forms[pid];
      const modelId = f.defaultModelId || f.modelIds[0];
      if (!f.apiKey || !modelId) {
        this.showToast(false, t('keyAndModelRequired'));
        return;
      }
      
      try {
        const res = await apiFetch(`/api/providers/${pid}/verify-model`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: f.apiKey, baseUrl: f.baseUrl || undefined, modelId }),
        }).then(r => r.json());
        
        this.verifies[pid] = { ok: Boolean(res.ok), error: res.error };
        if (res.ok) this.showToast(true, `${pid}/${modelId} ${t('verifySuccess')}`);
        this.renderProviderList();
      } catch (e) {
        this.showToast(false, `${t('verifyFailed')}${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    buildPayload() {
      // 找到第一个启用的 provider 作为默认
      const enabledProvider = this.presets.find(p => {
        const f = this.forms[p.id];
        return f.enabled && Boolean(f.apiKey) && f.modelIds.length > 0;
      });
      const defaultProviderId = enabledProvider ? enabledProvider.id : "openai";
      const defaultModelId = enabledProvider 
        ? (this.forms[enabledProvider.id].defaultModelId || this.forms[enabledProvider.id].modelIds[0] || "gpt-4o-mini")
        : "gpt-4o-mini";
      
      return {
        providers: this.presets.map(p => {
          const f = this.forms[p.id];
          return {
            providerId: p.id,
            apiKey: f.apiKey,
            baseUrl: f.baseUrl || undefined,
            modelIds: f.modelIds,
            defaultModelId: f.defaultModelId || f.modelIds[0] || "",
            modelFallbacks: f.modelIds,
            enabled: f.enabled && Boolean(f.apiKey) && f.modelIds.length > 0,
            enableModelFallback: f.modelIds.length > 1,
          };
        }),
        llm_global: {
          mode: "auto",
          defaultProviderId,
          defaultModelId,
        },
        enableProviderFallback: true,
        _source: "settings-ui",
      };
    }
    
    async persist(silent) {
      const res = await apiFetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.buildPayload()),
      }).then(r => r.json());
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      if (silent) this.autoSavedAt = new Date();
      else this.showToast(true, t('saved'));
    }
    
    async save() {
      this.saving = true;
      this.saveBtn.disabled = true;
      this.saveBtn.textContent = t('saving');
      
      try {
        await this.persist(false);
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        this.showToast(false, `${t('saveError')}${e.message}`);
      } finally {
        this.saving = false;
        this.saveBtn.disabled = false;
        this.saveBtn.textContent = t('saveAll');
      }
    }
    
    async reset() {
      if (!confirm(t('resetConfirmMsg'))) return;
      
      try {
        await fetch("/api/settings/reset", { method: "POST" });
        this.showToast(true, t('resetSuccess'));
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        this.showToast(false, `${t('resetError')}${e.message}`);
      }
    }
    
    async loadAllModels() {
      this.loadModelsBtn.disabled = true;
      this.loadModelsBtn.textContent = t('modelsLoading');
      
      for (const p of this.presets) {
        const f = this.forms[p.id];
        if (f.apiKey) {
          await this.fetchModels(p.id);
        }
      }
      
      this.loadModelsBtn.disabled = false;
      this.loadModelsBtn.textContent = t('loadLiveModels');
    }
    
    showToast(ok, text) {
      this.toast = { ok, text };
      const existing = this.modal.querySelector(".toast");
      if (existing) existing.remove();
      
      const toast = document.createElement("div");
      toast.className = `toast ${ok ? "ok" : "err"}`;
      toast.textContent = text;
      this.modal.querySelector(".settings").insertBefore(toast, this.modal.querySelector(".settings").children[1]);
      
      setTimeout(() => toast.remove(), 3000);
    }
  }

  // 导出到全局
  window.SettingsModal = SettingsModal;
})();
