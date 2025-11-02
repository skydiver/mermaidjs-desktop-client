export interface ExampleItem {
  id: string;
  label: string;
  content: string;
  order: number;
}

export interface ExamplesMenuOptions {
  button: HTMLButtonElement | null;
  menu: HTMLDivElement | null;
  items: ExampleItem[];
  onSelect?: (content: string, item: ExampleItem) => void | Promise<void>;
}

export function setupExamplesMenu({ button, menu, items, onSelect }: ExamplesMenuOptions): void {
  if (!button || !menu || items.length === 0) {
    return;
  }

  let isOpen = false;

  const renderMenu = () => {
    menu.innerHTML = '';
    items.forEach((item) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'toolbar-menu-item';
      option.role = 'menuitem';
      option.dataset.example = item.id;
      option.textContent = item.label;
      menu.append(option);
    });
  };

  renderMenu();

  const setOpen = (open: boolean) => {
    if (isOpen === open) return;
    isOpen = open;
    button.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;

    const method: 'addEventListener' | 'removeEventListener' = open
      ? 'addEventListener'
      : 'removeEventListener';
    document[method]('pointerdown', handlePointerDown, true);
    document[method]('keydown', handleDocumentKeydown);
  };

  const toggle = () => {
    setOpen(!isOpen);
  };

  const focusFirstItem = () => {
    const firstItem = menu.querySelector<HTMLButtonElement>('.toolbar-menu-item');
    firstItem?.focus();
  };

  const handlePointerDown = (event: Event) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (menu.contains(target) || button.contains(target)) {
      return;
    }
    setOpen(false);
  };

  const handleDocumentKeydown = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === 'Escape' && isOpen) {
      setOpen(false);
      button.focus();
    }
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    toggle();
    if (isOpen) {
      focusFirstItem();
    }
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      if (!isOpen) {
        setOpen(true);
      }
      event.preventDefault();
      focusFirstItem();
    }
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });

  menu.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      '.toolbar-menu-item'
    );
    if (!target) return;
    const id = target.dataset.example;
    if (!id) return;
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    event.preventDefault();
    setOpen(false);
    button.focus();
    onSelect?.(item.content, item);
  });
}
