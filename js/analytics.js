/* ============================================================
   CampusStay — Owner Analytics Dashboard
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  const user = await getCurrentUser();
  const profile = await getProfile();
  if (!user || !profile) return;

  // ---------- Greeting ----------
  const greeting = $('dash-greeting');
  const greetingSub = $('dash-greeting-sub');
  if (greeting) {
    greeting.textContent = `Welcome back, ${profile?.full_name || 'Owner'}!`;
    greetingSub.textContent = 'Track your property views, inquiries and performance.';
    document.title = `Analytics — ${profile?.full_name || 'CampusStay Owner'}`;
  }

  // Date range filter state
  let dateRange = '7d'; // '7d', '30d', '90d', 'all'

  // ---------- Chart instances ----------
  let barChart = null, lineChart = null, doughnutChart = null;

  // Build containers with skeleton placeholders
  document.querySelectorAll('.chart-canvas').forEach(el => {
    const canvasId = el.dataset.chart;
    if (!canvasId || !$('#' + canvasId)) return;
    el.innerHTML = `<canvas id="${canvasId}" width="800" height="400"></canvas>`;
  });

  // ---------- Export buttons ----------
  $('export-csv').addEventListener('click', exportCSV);
  $('export-json').addEventListener('click', exportJSON);

  // Date range selector
  const rangeSelect = $('date-range');
  rangeSelect.addEventListener('change', () => {
    dateRange = rangeSelect.value;
    renderAll();
  });

  // ---------- Load data ----------
  async function loadStats() {
    const sb = getSupabase();
    if (!sb) return null;

    const [viewRes, inquiryRes, reportRes] = await Promise.all([
      sb.from('property_views').select('property_id'),
      sb.from('inquiries').select('status'),
      sb.from('reports').select('status')
    ]);
    return { views: viewRes.data, inquiries: inquiryRes.data, reports: reportRes.data };
  }

  function rangeDateFilter() {
    if (dateRange === 'all') return {};
    const days = parseInt(dateRange, 10);
    const since = new Date();
    since.setDate(since.getDate() - days);
    return { since };
  }

  async function loadData() {
    const stats = await loadStats();
    if (!stats) return;

    // Count by status for doughnut and line charts
    const inquiryCounts = countByStatus(stats.inquiries || []);
    const reportCounts = countByStatus(stats.reports || []);
    const viewCount = (stats.views || []).length;
    const inquiryCount = stats.inquiries || [];

    return {
      viewCount,
      inquiryCounts,
      reportCounts,
      recentInquiries: inquiryCount
        ? inquiryCount.slice(-20).reverse().map((row) => ({
            created_at: row.created_at ? new Date(row.created_at).getTime() : null,
            message: row.message,
            title: row.properties?.title || ''
          }))
        : []
    };
  }

  function countByStatus(rows) {
    const counts = {};
    for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }

  // ---------- Render all charts ----------
  async function renderAll() {
    const data = await loadData();
    await Promise.all([renderStatCards(data), renderBarChart(data), renderLineChart(data), renderDoughnut(data)]);
  }

  function renderStatCards(data) {
    const $statCards = document.querySelectorAll('.stat-card');
    const cards = [
      { icon: '👁', label: 'Total Views', value: data.viewCount },
      { icon: '💬', label: 'Inquiries', value: data.inquiryCounts?.total ?? data.recentInquiries?.length ?? 0 },
      { icon: '⚠️', label: 'Reports Filed', value: data.reportCounts?.total ?? 0 },
      { icon: '⭐', label: 'Total Listings', value: '—' } // placeholder, filled separately if needed
    ];

    if ($statCards.length) {
      $statCards.forEach((card, i) => {
        card.querySelector('.stat-value').textContent = String(cards[i].value ?? '');
        card.querySelector('.stat-label').textContent = cards[i].label;
      });
    }
  }

  async function renderBarChart(data) {
    const canvas = $('#views-bar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearChart(ctx, canvas.width, canvas.height);

    // Group recent inquiries by day for the last 30 entries or selected range
    const recent = data.recentInquiries || [];
    const days = dateRange === '90d' ? 30 : (dateRange === '30d' ? 14 : 7);
    const buckets = new Array(days).fill(0);
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (days - 1 - i));
      buckets[i] = d.getMonthDay() === today.getMonthDay() ? 1 : 0; // simplified placeholder
    }

    drawAxisAndBars(ctx, canvas.width, canvas.height, buckets, 'Inquiries per day');
  }

  async function renderLineChart(data) {
    const canvas = $('#inquiries-line');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearChart(ctx, canvas.width, canvas.height);

    // Build activity timeline from inquiries
    const recent = data.recentInquiries || [];
    const buckets = new Array(Math.min(daysLabel(), 28)).fill(0);

    for (const item of recent) {
      if (!item.created_at) continue;
      const ts = new Date(item.created_at).getTime();
      const idx = Math.floor((ts - Date.now()) / 86400000);
      if (idx >= 0 && idx < buckets.length) buckets[idx]++;
    }

    drawAxisAndBars(ctx, canvas.width, canvas.height, buckets, 'Daily inquiry rate');
  }

  function daysLabel() { return 28; }

  function renderDoughnut(data) {
    const canvas = $('#status-doughnut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearChart(ctx, canvas.width, canvas.height);

    const labels = ['New', 'Contacted', 'Responded', 'Closed'];
    const colors = ['#3b5bdb', '#0ca678', '#f0883e', '#e15555'];
    const values = [
      data.inquiryCounts?.new || 0,
      data.inquiryCounts?.contacted || 0,
      data.inquiryCounts?.responded || 0,
      data.inquiryCounts?.closed || 0
    ];

    drawDoughnut(ctx, canvas.width, canvas.height, labels, values, colors);
  }

  function clearChart(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
  }

  function drawAxisAndBars(ctx, w, h, data, title) {
    const padding = { top: 30, right: 20, bottom: 50, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const max = Math.max(...data, 1);
    const barW = chartW / data.length * 0.6;

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, 20);

    // Bars
    data.forEach((val, i) => {
      const barH = (val / max) * chartH;
      const x = padding.left + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
      const y = padding.top + chartH - barH;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
      gradient.addColorStop(0, '#3b5bdb');
      gradient.addColorStop(1, '#0ca678');

      ctx.fillStyle = gradient;
      roundRect(ctx, x, y, barW, barH, 4);
      ctx.fill();

      // Value label on top
      if (val > 0 && barW > 20) {
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(val), x + barW / 2, y - 4);
      }
    });

    // X axis
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    ctx.lineTo(w - padding.right, padding.top + chartH);
    ctx.stroke();

    // Y axis gridlines
    ctx.textAlign = 'right';
    ctx.fillStyle = '#888';
    ctx.font = '11px Inter, sans-serif';
    const step = max <= 5 ? 1 : Math.ceil(max / 5);
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartH - (i / 5) * chartH;
      ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(i * step), padding.left - 8, y + 4);
    }
  }

  function drawDoughnut(ctx, w, h, labels, values, colors) {
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(w, h) / 2 - 30;
    const innerR = outerR * 0.5;

    const total = values.reduce((s, v) => s + v, 0);
    if (total === 0) {
      ctx.fillStyle = '#444';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data', cx, cy);
      return;
    }

    labels.forEach((label, i) => {
      const angle = (values[i] / total) * Math.PI * 2 - Math.PI / 2;
      const start = -Math.PI / 2;
      const end = start + angle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i] || '#555';
      ctx.fill();

      // Label at midpoint
      const midAngle = start + (end - start) / 2;
      const lx = cx + (outerR + 12) * Math.cos(midAngle);
      const ly = cy + (outerR + 12) * Math.sin(midAngle);
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = lx > cx ? 'left' : 'right';
      ctx.fillText(values[i], lx, ly);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(label, lx, ly + 14);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Export ----------
  function exportCSV() {
    const sb = getSupabase();
    if (!sb) return;
    Promise.all([
      sb.from('property_views').select('property_id'),
      sb.from('inquiries').select('*'),
      sb.from('reports').select('*')
    ]).then(([views, inquiries, reports]) => {
      let csv = 'Type,ID,Created At\n';
      views.forEach(v => csv += `view,${v.property_id},${new Date(v.viewed_at).toISOString()}\n`);
      inquiries.forEach(q => csv += `inquiry,${q.id},${new Date(q.created_at).toISOString()}\n`);
      reports.forEach(r => csv += `report,${r.id},${new Date(r.created_at).toISOString()}\n`);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'campusstay-analytics.csv';
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {});
  }

  function exportJSON() {
    const sb = getSupabase();
    if (!sb) return;
    Promise.all([
      sb.from('property_views').select('property_id, viewed_at'),
      sb.from('inquiries').select('*'),
      sb.from('reports').select('*')
    ]).then(([views, inquiries, reports]) => {
      const payload = { exports: { views, inquiries, reports }, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'campusstay-analytics.json';
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {});
  }

  // Initial render
  renderAll();
});
