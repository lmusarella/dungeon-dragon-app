export function createToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  const container = document.querySelector('[data-toast-container]');
  if (container) {
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 20);
    setTimeout(() => {
      toast.classList.remove('visible');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3200);
  }
}

export function openDrawer(content) {
  const drawer = document.querySelector('[data-drawer]');
  const body = document.querySelector('[data-drawer-body]');
  if (!drawer || !body) return;
  body.innerHTML = '';
  body.appendChild(content);
  drawer.classList.add('open');
}

export function closeDrawer() {
  const drawer = document.querySelector('[data-drawer]');
  if (drawer) {
    drawer.classList.remove('open');
  }
}

export function buildDrawerLayout(titleText, formEl, actions = []) {
  const wrapper = document.createElement('div');
  wrapper.className = 'drawer-content';

  const title = document.createElement('h2');
  title.textContent = titleText;
  wrapper.appendChild(title);

  wrapper.appendChild(formEl);

  if (actions.length) {
    const footer = document.createElement('div');
    footer.className = 'drawer-actions';
    actions.forEach((action) => footer.appendChild(action));
    wrapper.appendChild(footer);
  }

  return wrapper;
}

export function buildSelect(options, value) {
  const select = document.createElement('select');
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

export function buildInput({ label, name, type = 'text', value = '', placeholder = '' }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  wrapper.appendChild(span);
  wrapper.appendChild(input);
  return wrapper;
}

export function buildTextarea({ label, name, value = '', placeholder = '' }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('textarea');
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  wrapper.appendChild(span);
  wrapper.appendChild(input);
  return wrapper;
}
