// ==UserScript==
// @name         ChatGPT Thinking Quick Switch
// @namespace    https://chatgpt.com/
// @version      0.1.0
// @description  Floating quick buttons for ChatGPT thinking effort: 均衡, 超高, and Pro 扩展.
// @author       Codex
// @license      MIT
// @homepageURL  https://github.com/jiang-yuan/chatgpt-thinking-quick-switch
// @downloadURL  https://raw.githubusercontent.com/jiang-yuan/chatgpt-thinking-quick-switch/main/chatgpt-thinking-quick-switch.user.js
// @updateURL    https://raw.githubusercontent.com/jiang-yuan/chatgpt-thinking-quick-switch/main/chatgpt-thinking-quick-switch.user.js
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const UI_ID = 'cgpt-thinking-quick-switch';
  const STYLE_ID = 'cgpt-thinking-quick-switch-style';
  const POSITION_MARGIN = 12;

  const TARGETS = [
    {
      key: 'balanced',
      label: '均衡',
      title: '切换到均衡思考强度',
      matches: (text) => /^(均衡|balanced|balance)$/i.test(normalizeText(text)),
    },
    {
      key: 'ultra',
      label: '超高',
      title: '切换到超高思考强度',
      matches: (text) => /^(超高|ultra|ultra high|very high|highest|maximum)$/i.test(normalizeText(text)),
    },
    {
      key: 'pro_extended',
      label: 'Pro',
      title: '切换到 Pro 扩展思考强度；普通 Pro/专业不会被当作命中',
      matches: matchesProExtended,
    },
  ];

  const KNOWN_EFFORT_MATCHERS = [
    ...TARGETS.map((target) => target.matches),
    (text) => /^(极速|快速|fast|quick)$/i.test(normalizeText(text)),
    (text) => /^(高级|高|advanced|high)$/i.test(normalizeText(text)),
  ];

  let scheduled = false;
  let lastStatus = '';

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchesProExtended(text) {
    const value = normalizeText(text);
    if (!value) return false;

    const hasProName = /\bpro\b/i.test(value) || /专业/i.test(value);
    const hasExtended = /扩展|extended|extension/i.test(value);
    return hasProName && hasExtended;
  }

  function isVisible(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getElementText(element) {
    return normalizeText(
      element.innerText ||
        element.textContent ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        ''
    );
  }

  function isKnownEffortText(text) {
    return KNOWN_EFFORT_MATCHERS.some((matches) => matches(text));
  }

  function findPromptBox() {
    return document.querySelector(
      [
        '#prompt-textarea',
        '[data-testid="prompt-textarea"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea[placeholder*="ChatGPT"]',
        'textarea[placeholder*="聊天"]',
      ].join(',')
    );
  }

  function findComposer() {
    const promptBox = findPromptBox();
    if (!promptBox) return null;

    const form = promptBox.closest('form');
    if (form) return form;

    let current = promptBox.parentElement;
    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      const hasButtons = current.querySelectorAll('button').length >= 2;
      const isLikelyComposer = hasButtons && rect.height > 32 && rect.height < 220 && rect.bottom > window.innerHeight * 0.45;
      if (isLikelyComposer) return current;
      current = current.parentElement;
    }

    return promptBox.parentElement;
  }

  function findEffortTrigger() {
    const composer = findComposer();
    const scopedButtons = composer ? Array.from(composer.querySelectorAll('button')) : [];
    const scopedMatch = scopedButtons.find((button) => isVisible(button) && isLikelyEffortTrigger(button));
    if (scopedMatch) return scopedMatch;

    return Array.from(document.querySelectorAll('button')).find((button) => {
      if (!isVisible(button) || button.closest(`#${UI_ID}`)) return false;
      return isLikelyEffortTrigger(button);
    });
  }

  function isLikelyEffortTrigger(button) {
    const text = getElementText(button);
    if (!isKnownEffortText(text)) return false;

    const ariaLabel = normalizeText(button.getAttribute('aria-label'));
    if (/个人资料|profile|account/i.test(ariaLabel)) return false;
    if (text.length > 24) return false;

    return true;
  }

  function findOpenMenuItems() {
    const menuRoots = Array.from(document.querySelectorAll('[role="menu"], [role="listbox"]')).filter(isVisible);
    const selectors = '[role="menuitemradio"], [role="menuitem"], [role="option"]';
    const itemElements = menuRoots.length
      ? menuRoots.flatMap((root) => Array.from(root.querySelectorAll(selectors)))
      : Array.from(document.querySelectorAll(selectors));

    return itemElements
      .filter(isVisible)
      .map((element) => ({
        element,
        text: getElementText(element),
        checked:
          element.getAttribute('aria-checked') === 'true' ||
          element.getAttribute('data-state') === 'checked' ||
          element.querySelector('[data-state="checked"], [aria-checked="true"]') != null,
      }))
      .filter((item) => item.text.length > 0 && item.text.length <= 40);
  }

  function waitFor(predicate, timeoutMs = 1600, intervalMs = 50) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const value = predicate();
        if (value) {
          resolve(value);
          return;
        }

        if (Date.now() - start >= timeoutMs) {
          reject(new Error('Timed out while waiting for ChatGPT menu state.'));
          return;
        }

        window.setTimeout(tick, intervalMs);
      };

      tick();
    });
  }

  async function openEffortMenu() {
    const trigger = findEffortTrigger();
    if (!trigger) {
      throw new Error('没有找到 ChatGPT 原生思考强度按钮。');
    }

    trigger.click();
    await waitFor(() => findOpenMenuItems().length > 0);
    return findOpenMenuItems();
  }

  function closeMenus() {
    const eventInit = {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    };

    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    document.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  }

  function getCurrentEffortText() {
    return getElementText(findEffortTrigger());
  }

  async function readCheckedEffortText() {
    const items = await openEffortMenu();
    const checked = items.find((item) => item.checked);
    closeMenus();
    return checked ? checked.text : '';
  }

  async function selectTarget(target) {
    setStatus('busy', `正在切换到 ${target.label}`);

    try {
      const items = await openEffortMenu();
      const visibleTexts = items.map((item) => item.text);
      const matched = items.find((item) => target.matches(item.text));

      if (!matched) {
        closeMenus();
        const available = visibleTexts.join(' / ') || '未扫描到可用项';
        throw new Error(`没有找到 ${target.title}。当前菜单项：${available}`);
      }

      matched.element.click();

      await waitFor(() => target.matches(getCurrentEffortText()), 2200).catch(async () => {
        const checkedText = await readCheckedEffortText().catch(() => '');
        if (!target.matches(checkedText)) {
          throw new Error(`点击后未确认切到 ${target.label}。当前显示：${getCurrentEffortText() || checkedText || '未知'}`);
        }
      });

      setStatus('ok', `已切换到 ${target.label}`);
      refreshActiveButton();
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : String(error));
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${UI_ID} {
        position: fixed;
        z-index: 2147483647;
        display: flex;
        gap: 6px;
        align-items: center;
        pointer-events: auto;
        transition: opacity 120ms ease, transform 120ms ease;
      }

      #${UI_ID}[hidden] {
        display: none;
      }

      #${UI_ID} button {
        min-width: 52px;
        height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(0, 0, 0, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        color: #111;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        cursor: pointer;
        font: 500 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
        white-space: nowrap;
      }

      #${UI_ID} button:hover {
        background: #f5f5f5;
        border-color: rgba(0, 0, 0, 0.28);
      }

      #${UI_ID} button:disabled {
        cursor: progress;
        opacity: 0.62;
      }

      #${UI_ID} button[data-active="true"] {
        background: #111;
        border-color: #111;
        color: #fff;
      }

      #${UI_ID}[data-state="error"] button {
        border-color: #d33a2c;
      }

      html.dark #${UI_ID} button,
      [data-theme="dark"] #${UI_ID} button {
        background: rgba(32, 33, 35, 0.96);
        border-color: rgba(255, 255, 255, 0.22);
        color: #f5f5f5;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32);
      }

      html.dark #${UI_ID} button:hover,
      [data-theme="dark"] #${UI_ID} button:hover {
        background: #2c2d30;
      }

      html.dark #${UI_ID} button[data-active="true"],
      [data-theme="dark"] #${UI_ID} button[data-active="true"] {
        background: #f5f5f5;
        border-color: #f5f5f5;
        color: #111;
      }
    `;
    document.head.appendChild(style);
  }

  function createUi() {
    ensureStyle();

    let root = document.getElementById(UI_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = UI_ID;

    TARGETS.forEach((target) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.target = target.key;
      button.textContent = target.label;
      button.title = target.title;
      button.addEventListener('click', () => selectTarget(target));
      root.appendChild(button);
    });

    document.body.appendChild(root);
    return root;
  }

  function setStatus(state, message) {
    const root = createUi();
    root.dataset.state = state;
    root.title = message;
    lastStatus = message;

    Array.from(root.querySelectorAll('button')).forEach((button) => {
      button.disabled = state === 'busy';
    });
  }

  function refreshActiveButton() {
    const root = createUi();
    const currentText = getCurrentEffortText();
    const activeTarget = TARGETS.find((target) => target.matches(currentText));

    Array.from(root.querySelectorAll('button')).forEach((button) => {
      button.dataset.active = String(button.dataset.target === activeTarget?.key);
      button.disabled = root.dataset.state === 'busy';
    });

    if (activeTarget && root.dataset.state !== 'busy') {
      root.dataset.state = 'ready';
      root.title = `当前思考强度：${currentText}`;
    } else if (!lastStatus) {
      root.title = '点击快捷按钮会实时扫描 ChatGPT 原生思考强度菜单';
    }
  }

  function positionUi() {
    const root = createUi();
    const composer = findComposer();
    const trigger = findEffortTrigger();

    if (!composer || !trigger) {
      root.hidden = true;
      return;
    }

    root.hidden = false;

    const composerRect = composer.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const width = rootRect.width || 180;
    const height = rootRect.height || 34;

    let left = composerRect.right + 8;
    let top = triggerRect.top + (triggerRect.height - height) / 2;

    if (left + width > window.innerWidth - POSITION_MARGIN) {
      left = Math.min(window.innerWidth - width - POSITION_MARGIN, composerRect.right - width - POSITION_MARGIN);
      top = composerRect.top - height - 8;
    }

    left = Math.max(POSITION_MARGIN, left);
    top = Math.max(POSITION_MARGIN, Math.min(window.innerHeight - height - POSITION_MARGIN, top));

    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  function refresh() {
    scheduled = false;
    createUi();
    positionUi();
    refreshActiveButton();
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(refresh);
  }

  function init() {
    scheduleRefresh();

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-checked', 'data-state', 'class', 'style'],
    });

    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('scroll', scheduleRefresh, { passive: true, capture: true });
    window.setInterval(scheduleRefresh, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
