/** Un solo valore governa il ritaglio del disegno, del testo e il separatore. */
const hero = document.querySelector<HTMLElement>("[data-hero-comparison]");
if (hero) initComparison(hero);

function initComparison(root: HTMLElement) {
  const scene = root.querySelector<HTMLElement>("[data-hero-scene]");
  const text = root.querySelector<HTMLElement>("[data-hero-text]");
  const slider = root.querySelector<HTMLElement>("[data-hero-slider]");
  const controls = root.querySelector<HTMLElement>("[data-hero-controls]");
  if (!scene || !text || !slider || !controls) return;

  const sceneEl = scene;
  const textEl = text;
  const sliderEl = slider;
  const links = [...textEl.querySelectorAll<HTMLAnchorElement>("a")];
  const mobile = window.matchMedia("(width < 60rem)");
  let value = mobile.matches ? 50 : 64;
  let interacted = false;
  let frame = 0;
  let pointer: number | null = null;
  let grabOffset = 0;
  let sceneLeft = 0;
  let sceneWidth = 1;
  let gripHalf = 28;
  let textRight = 0;
  let linkEdges: number[] = [];

  function initialValue() {
    return mobile.matches ? 50 : Math.min(95, Math.max(64, ((textRight + 48) / sceneWidth) * 100));
  }

  function render() {
    frame = 0;
    root.style.setProperty("--hero-reveal", `${value}%`);
    const rounded = Math.round(value);
    sliderEl.setAttribute("aria-valuenow", String(rounded));
    sliderEl.setAttribute("aria-valuetext", `${rounded}% disegno, ${100 - rounded}% render`);

    // Un CTA tagliato non deve lasciare un bersaglio invisibile nella tabulazione.
    // Il titolo rimane nel documento anche quando il visitatore mostra il render.
    const edge = (value / 100) * sceneWidth;
    links.forEach((link, i) => {
      const clipped = !mobile.matches && linkEdges[i] + 4 > edge;
      if (clipped && document.activeElement === link) sliderEl.focus({ preventScroll: true });
      link.inert = clipped;
    });
  }

  function update(next: number) {
    value = Math.min(100, Math.max(0, next));
    if (!frame) frame = requestAnimationFrame(render);
  }

  function measure() {
    const bounds = sceneEl.getBoundingClientRect();
    sceneLeft = bounds.left;
    sceneWidth = bounds.width || 1;
    gripHalf = sliderEl.getBoundingClientRect().width / 2;
    textRight = textEl.getBoundingClientRect().right - sceneLeft;
    linkEdges = links.map((link) => link.getBoundingClientRect().right - sceneLeft);
    if (!interacted) value = initialValue();
    if (frame) cancelAnimationFrame(frame);
    render();
  }

  function markInteraction() {
    interacted = true;
    root.setAttribute("data-interacted", "");
  }

  function pointerValue(clientX: number) {
    const x = clientX - sceneLeft;
    // Anche dopo aver afferrato la presa rientrata dal bordo, entrambi gli
    // estremi devono essere raggiungibili senza uscire dallo schermo.
    if (x <= gripHalf) return 0;
    if (x >= sceneWidth - gripHalf) return 100;
    return ((x + grabOffset) / sceneWidth) * 100;
  }

  function endDrag() {
    if (pointer !== null && sliderEl.hasPointerCapture(pointer)) {
      sliderEl.releasePointerCapture(pointer);
    }
    pointer = null;
    root.removeAttribute("data-dragging");
  }

  sliderEl.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    measure();
    markInteraction();
    pointer = event.pointerId;
    // Evita il salto quando la presa è rientrata dal bordo a 0 o 100%.
    grabOffset = (value / 100) * sceneWidth - (event.clientX - sceneLeft);
    sliderEl.setPointerCapture(pointer);
    sliderEl.focus({ preventScroll: true });
    root.setAttribute("data-dragging", "");
  });

  sliderEl.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer) return;
    update(pointerValue(event.clientX));
  });

  sliderEl.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointer) return;
    update(pointerValue(event.clientX));
    endDrag();
  });
  sliderEl.addEventListener("pointercancel", endDrag);
  sliderEl.addEventListener("lostpointercapture", endDrag);

  sliderEl.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 2;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = value - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = value + step;
        break;
      case "PageDown":
        next = value - 10;
        break;
      case "PageUp":
        next = value + 10;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 100;
        break;
      default:
        return;
    }
    event.preventDefault();
    markInteraction();
    update(next);
  });

  const observer = new ResizeObserver(measure);
  observer.observe(sceneEl);
  observer.observe(textEl);
  mobile.addEventListener("change", () => {
    endDrag();
    interacted = false;
    root.removeAttribute("data-interacted");
    measure();
  });
  void document.fonts.ready.then(measure);
  measure();
  controls.hidden = false;
}
