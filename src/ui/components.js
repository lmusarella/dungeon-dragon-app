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

export function openConfirmModal({
  title = 'Conferma',
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.querySelector('[data-confirm-modal]');
    if (!modal) {
      resolve(false);
      return;
    }
    const titleEl = modal.querySelector('[data-confirm-title]');
    const messageEl = modal.querySelector('[data-confirm-message]');
    const confirmButton = modal.querySelector('[data-confirm-ok]');
    const cancelButton = modal.querySelector('[data-confirm-cancel]');
    const overlay = modal.querySelector('[data-confirm-overlay]');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message || '';
    if (confirmButton) confirmButton.textContent = confirmLabel;
    if (cancelButton) cancelButton.textContent = cancelLabel;

    modal.hidden = false;
    modal.classList.add('open');

    const cleanup = (result) => {
      modal.classList.remove('open');
      modal.hidden = true;
      confirmButton?.removeEventListener('click', onConfirm);
      cancelButton?.removeEventListener('click', onCancel);
      overlay?.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);

    confirmButton?.addEventListener('click', onConfirm);
    cancelButton?.addEventListener('click', onCancel);
    overlay?.addEventListener('click', onCancel);
  });
}

export function openFormModal({
  title = 'Inserisci dati',
  content = '',
  submitLabel = 'Conferma',
  cancelLabel = 'Annulla',
  cardClass = ''
} = {}) {
  return new Promise((resolve) => {
    const modal = document.querySelector('[data-form-modal]');
    if (!modal) {
      resolve(null);
      return;
    }
    const modalCard = modal.querySelector('.modal-card');
    const titleEl = modal.querySelector('[data-form-title]');
    const formEl = modal.querySelector('[data-form-body]');
    const fieldsEl = modal.querySelector('[data-form-fields]');
    const submitButton = modal.querySelector('[data-form-submit]');
    const cancelButton = modal.querySelector('[data-form-cancel]');
    const overlay = modal.querySelector('[data-form-overlay]');
    const previousClasses = modal.dataset.formCardClasses?.split(' ').filter(Boolean) ?? [];
    if (modalCard && previousClasses.length) {
      previousClasses.forEach((cls) => modalCard.classList.remove(cls));
    }
    const nextClasses = Array.isArray(cardClass)
      ? cardClass
      : cardClass
        ? [cardClass]
        : [];
    if (modalCard && nextClasses.length) {
      nextClasses.forEach((cls) => modalCard.classList.add(cls));
    }
    modal.dataset.formCardClasses = nextClasses.join(' ');

    if (titleEl) titleEl.textContent = title;
    if (submitButton) submitButton.textContent = submitLabel;
    if (cancelButton) {
      if (cancelLabel === null) {
        cancelButton.hidden = true;
      } else {
        cancelButton.hidden = false;
        cancelButton.textContent = cancelLabel;
      }
    }
    if (fieldsEl) {
      fieldsEl.innerHTML = '';
      if (typeof content === 'string') {
        fieldsEl.innerHTML = content;
      } else if (content) {
        fieldsEl.appendChild(content);
      }
    }

    modal.hidden = false;
    modal.classList.add('open');

    const cleanup = (result) => {
      modal.classList.remove('open');
      modal.hidden = true;
      if (modalCard && modal.dataset.formCardClasses) {
        modal.dataset.formCardClasses.split(' ').filter(Boolean)
          .forEach((cls) => modalCard.classList.remove(cls));
        modal.dataset.formCardClasses = '';
      }
      formEl?.removeEventListener('submit', onSubmit);
      cancelButton?.removeEventListener('click', onCancel);
      overlay?.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onSubmit = (event) => {
      event.preventDefault();
      const data = formEl ? new FormData(formEl) : null;
      cleanup(data);
    };

    const onCancel = () => cleanup(null);

    formEl?.addEventListener('submit', onSubmit);
    cancelButton?.addEventListener('click', onCancel);
    overlay?.addEventListener('click', onCancel);
  });
}
