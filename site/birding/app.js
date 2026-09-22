'use strict';
const ui = Object.fromEntries(['feed','health','indicator','updated','search','area','count','more','end','empty','sentinel'].map(id => [id, document.getElementById(id)]));
let items = [], filtered = [], offset = 0, lastDay = '', observer;
const batchSize = 20;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function safeSource(url) {
  try {
    const value = new URL(url);
    return value.origin === 'https://digest-test.sialia.com' && /^\?rm=message;id=\d+$/.test(value.search) ? value.href : null;
  } catch { return null; }
}

function appendBatch() {
  const fragment = document.createDocumentFragment();
  for (const item of filtered.slice(offset, offset + batchSize)) {
    const day = item.reported_at.slice(0, 10);
    if (day !== lastDay) {
      fragment.append(element('h2', day.replaceAll('-', ' / '), 'date-heading'));
      lastDay = day;
    }
    const card = element('article');
    const meta = element('div', undefined, 'meta');
    meta.append(element('span', item.area, 'badge'), element('span', item.kind === 'reply' ? '回复 / 转发' : '社区消息'), element('time', item.reported_at.slice(11, 16)));
    const heading = element('h3');
    const link = element('a', item.title);
    link.href = safeSource(item.source_url);
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    heading.append(link);
    const foot = element('div', undefined, 'record-footer');
    const original = element('a', '阅读原帖 ↗');
    original.href = link.href; original.target = '_blank'; original.rel = link.rel;
    foot.append(element('span', `Sialia · ${item.list}`), original);
    card.append(meta, heading, foot);
    fragment.append(card);
  }
  offset = Math.min(offset + batchSize, filtered.length);
  ui.feed.append(fragment);
  ui.more.hidden = offset >= filtered.length;
  ui.end.textContent = offset < filtered.length ? `已显示 ${offset} / ${filtered.length} 条 · 继续向下滚动` : (filtered.length ? '已读到这份记录的最早一条' : '');
  // Re-observe so very tall windows can load enough records to fill the screen.
  if (observer) { observer.unobserve(ui.sentinel); if (offset < filtered.length) observer.observe(ui.sentinel); }
}

function filter() {
  const query = ui.search.value.trim().toLocaleLowerCase();
  filtered = items.filter(item => (!ui.area.value || item.area === ui.area.value) && `${item.title} ${item.list} ${item.area}`.toLocaleLowerCase().includes(query));
  offset = 0; lastDay = ''; ui.feed.replaceChildren();
  ui.count.textContent = `${filtered.length} 条消息`;
  ui.empty.hidden = filtered.length !== 0;
  appendBatch();
}

async function load() {
  ui.health.textContent = '正在读取鸟讯…';
  try {
    const response = await fetch('/birding/feed.json', {cache: 'no-store', signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.items) || !data.sources?.sialia) throw new Error('Unsupported feed');
    items = data.items.filter(item => typeof item.title === 'string' && typeof item.list === 'string' && typeof item.area === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(item.reported_at) && safeSource(item.source_url));
    items.sort((a,b) => b.reported_at.localeCompare(a.reported_at) || b.id.localeCompare(a.id));
    const source = data.sources.sialia;
    const age = Date.now() - Date.parse(source.last_success_at);
    const stale = !Number.isFinite(age) || age > 3 * 60 * 60 * 1000;
    const healthy = source.status === 'ok' && !stale;
    ui.indicator.className = `dot ${healthy ? 'ok' : 'warning'}`;
    ui.health.textContent = healthy ? 'Sialia 已更新 · 计划每小时检查' : source.status !== 'ok' ? '最近采集不完整，正在显示已保存的消息' : '超过 3 小时未成功更新，正在显示已保存的消息';
    const fmt = value => new Date(value).toLocaleString('zh-CN', {timeZone: 'America/Los_Angeles',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    ui.updated.textContent = `最近检查：${fmt(data.generated_at)} · 上次成功：${source.last_success_at ? fmt(source.last_success_at) : '尚无'}（湾区时间）`;
    ui.more.textContent = '加载更早的消息';
    ui.more.onclick = appendBatch;
    ui.search.disabled = false; ui.area.disabled = false;
    if ('IntersectionObserver' in window) observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && offset < filtered.length) appendBatch();
    }, {rootMargin:'300px'});
    filter();
  } catch {
    ui.indicator.className = 'dot warning';
    ui.health.textContent = '暂时无法读取鸟讯，请稍后重试。';
    ui.updated.textContent = '数据加载失败，不代表没有新的鸟讯。';
    ui.count.textContent = '未能加载';
    ui.more.hidden = false; ui.more.textContent = '重新加载'; ui.more.onclick = load;
  }
}
ui.search.addEventListener('input', filter);
ui.area.addEventListener('change', filter);
load();
