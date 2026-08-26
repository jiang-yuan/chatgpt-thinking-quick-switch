const test = require('node:test');
const assert = require('node:assert/strict');

const {
  closeMenus,
  findAdvancedToggleItem,
  findEffortSubmenuItem,
  findEffortSliderControl,
  getSliderTargetValue,
  shouldTreatAsFinalEffortMenu,
} = require('./chatgpt-thinking-quick-switch.user.js');

function menuItem(text, attributes = {}, descendants = {}) {
  return {
    text,
    element: {
      getAttribute(name) {
        return attributes[name] ?? null;
      },
      querySelector(selector) {
        return descendants[selector] ?? null;
      },
    },
  };
}

test('finds the advanced toggle when the compact slider menu hides detailed controls', () => {
  const items = [
    menuItem(''),
    menuItem('高级', { 'aria-label': '显示高级选项' }),
  ];

  assert.equal(findAdvancedToggleItem(items), items[1]);
});

test('finds the thinking-effort submenu without confusing model or final options', () => {
  const items = [
    menuItem('模型 GPT-5.6 Sol', { 'aria-haspopup': 'menu' }),
    menuItem('思考强度 极高', { 'aria-haspopup': 'menu' }),
    menuItem('极高'),
  ];

  assert.equal(findEffortSubmenuItem(items), items[1]);
});

test('finds the reasoning-effort submenu used by ChatGPT 5.6', () => {
  const items = [
    menuItem('模型 GPT-5.6 Sol', { 'aria-haspopup': 'menu' }),
    menuItem('推理强度 极高', { 'aria-haspopup': 'menu' }),
    menuItem('极高'),
  ];

  assert.equal(findEffortSubmenuItem(items), items[1]);
});

test('does not treat the model menu as final when it also contains an effort submenu', () => {
  const items = [
    menuItem('高级'),
    menuItem('推理强度 中', { 'aria-haspopup': 'menu' }),
  ];

  assert.equal(shouldTreatAsFinalEffortMenu(items), false);
});

test('finds the five-step reasoning effort slider control', () => {
  const slider = { getAttribute: () => null };
  const items = [
    menuItem('高级'),
    menuItem('能力', { 'aria-keyshortcuts': 'ArrowLeft ArrowRight' }, { '[role="slider"]': slider }),
    menuItem('推理强度 中', { 'aria-haspopup': 'menu' }),
  ];

  assert.equal(findEffortSliderControl(items)?.slider, slider);
});

test('maps quick targets to the five-step slider positions', () => {
  assert.equal(getSliderTargetValue('balanced', 0, 4), 1);
  assert.equal(getSliderTargetValue('ultra', 0, 4), 3);
  assert.equal(getSliderTargetValue('pro_extended', 0, 4), 4);
});

test('releases Escape after closing menus so other extensions do not see a stuck key', () => {
  const originalDocument = global.document;
  const originalKeyboardEvent = global.KeyboardEvent;
  const events = [];

  global.KeyboardEvent = class KeyboardEvent {
    constructor(type, init) {
      this.type = type;
      this.key = init.key;
    }
  };
  global.document = {
    activeElement: {
      dispatchEvent(event) {
        events.push(`active:${event.type}:${event.key}`);
      },
    },
    dispatchEvent(event) {
      events.push(`document:${event.type}:${event.key}`);
    },
  };

  try {
    closeMenus();
  } finally {
    global.document = originalDocument;
    global.KeyboardEvent = originalKeyboardEvent;
  }

  assert.deepEqual(events, [
    'active:keydown:Escape',
    'active:keyup:Escape',
    'document:keydown:Escape',
    'document:keyup:Escape',
  ]);
});
