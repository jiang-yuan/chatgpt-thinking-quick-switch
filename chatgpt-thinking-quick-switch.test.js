const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findAdvancedToggleItem,
  findEffortSubmenuItem,
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
