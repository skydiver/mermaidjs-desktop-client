export interface ExportMenuOptions {
  button: HTMLButtonElement | null;
  menu: HTMLDivElement | null;
}

export function setupExportMenu({ button, menu }: ExportMenuOptions): void {
  if (!button || !menu) {
    return;
  }

  let isOpen = false;

  const setOpen = (open: boolean) => {
    if (isOpen === open) return;
    isOpen = open;
    button.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;

    const method: 'addEventListener' | 'removeEventListener' = open ? 'addEventListener' : 'removeEventListener';
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

  const handleDocumentKeydown = (event: KeyboardEvent) => {
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
}
