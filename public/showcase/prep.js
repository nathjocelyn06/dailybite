// Prepares a device.html mockup for capture: cleans the dev overlay/scrollbars
// and fills the dashboard's calorie ring + meal plan with real DailyBite figures.
window.prep = async function (dev) {
  const f = document.getElementById(dev === 'laptop' ? 'fl' : 'fp');
  await new Promise(r => {
    if (f.contentDocument && f.contentDocument.readyState === 'complete') r();
    else f.onload = r;
  });
  const d = f.contentDocument;
  d.documentElement.style.overflow = 'hidden';
  const st = d.createElement('style');
  st.textContent = '::-webkit-scrollbar{width:0;height:0;display:none}' +
                   'html{scrollbar-width:none;overflow:hidden}' +
                   'nextjs-portal{display:none!important}';
  d.head.appendChild(st);
  await new Promise(r => setTimeout(r, 8000));
  d.querySelectorAll('nextjs-portal').forEach(n => n.remove());

  if (dev === 'laptop') {
    const left = d.querySelector('.cal-left'), total = d.querySelector('.cal-total');
    if (left) left.textContent = '654 remaining';
    if (total) total.textContent = '846/1,500';
    const vals = [[37, 90], [118, 220], [29, 60]];
    d.querySelectorAll('.macro').forEach((m, i) => {
      const [v, g] = vals[i] || [0, 0];
      const em = m.querySelector('.macro-head em'); if (em) em.textContent = v + ' / ' + g + ' g';
      const sp = m.querySelector('.bar > span'); if (sp) sp.style.width = Math.round(v / g * 100) + '%';
    });
    const ring = d.querySelector('svg.cal-ring');
    if (ring && !ring.dataset.filled) {
      ring.dataset.filled = '1';
      const R = 56, C = 2 * Math.PI * R, pct = 846 / 1500, ns = 'http://www.w3.org/2000/svg';
      const c = d.createElementNS(ns, 'circle');
      c.setAttribute('cx', '70'); c.setAttribute('cy', '70'); c.setAttribute('r', String(R));
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', getComputedStyle(d.documentElement).getPropertyValue('--accent-strong').trim());
      c.setAttribute('stroke-width', '11'); c.setAttribute('stroke-linecap', 'round');
      c.setAttribute('stroke-dasharray', String(C));
      c.setAttribute('stroke-dashoffset', String(C * (1 - pct)));
      c.setAttribute('transform', 'rotate(-90 70 70)');
      ring.appendChild(c);
    }
    const slots = d.querySelectorAll('.slots .slot');
    const filled = [
      { slot: 'breakfast', name: 'Tuna and Egg Briks', kcal: 312, img: '/showcase/recipe-briks.jpg' },
      { slot: 'lunch', name: 'Spinach &amp; Ricotta Cannelloni', kcal: 534, img: '/showcase/recipe-cannelloni.jpg' }
    ];
    filled.forEach((x, i) => {
      const el = slots[i]; if (!el) return;
      el.classList.remove('slot-empty');
      el.innerHTML = '<span class="slot-dot slot-' + x.slot + '"></span>' +
        '<span class="slot-thumb"><img class="thumb" src="' + x.img + '" alt=""></span>' +
        '<span class="slot-text"><strong>' + x.name + '</strong>' +
        '<span class="muted">' + x.slot + ' &middot; ' + x.kcal + ' kcal</span></span>';
    });
    if (slots[2]) {
      const m = slots[2].querySelector('.slot-text .muted');
      if (m) m.textContent = 'Planned: Chicken Ham and Leek Pie';
    }
    const g = d.querySelector('.h1'); if (g) g.textContent = 'Good afternoon';
    await Promise.all([...d.querySelectorAll('.slot-thumb img')]
      .map(im => im.complete ? 0 : new Promise(r => { im.onload = r; im.onerror = r; })));
  }

  await new Promise(r => setTimeout(r, 800));
  document.body.className = 'bg-white';
  const el = document.getElementById(dev);
  const s = parseFloat(new URLSearchParams(location.search).get('s') || '3');
  return { w: Math.round(el.offsetWidth * s), h: Math.round(el.offsetHeight * s),
           layoutW: d.documentElement.clientWidth };
};
