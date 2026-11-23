export function renderWaveform(element) {
  element.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 70; i++) {
    const bar = document.createElement('i'); bar.className = 'wavebar';
    const height = 8 + Math.abs(Math.sin(i * 2.17) * Math.cos(i * .31)) * 42;
    bar.style.height = height + 'px'; bar.style.left = (i / 70 * 100) + '%';
    fragment.append(bar);
  }
  element.append(fragment);
}