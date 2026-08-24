const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findAdvancedToggleItem,
  findEffortSubmenuItem,
  shouldTreatAsFinalEffortMenu,
} = require('./chatgpt-thinking-quick-switch.user.js');

function menuItem(text, attributes = {}) {
  return {
    text,
    element: {
      getAttribute(name) {
        return attributes[name] ?? null;
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
