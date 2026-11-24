/* ============================================================
   CampusStay — Rules Entry Logic (Step 4)
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const propertyId = params.get('property') || sessionStorage.getItem('cs:property-id');

  if (!propertyId) {
    CS.toast('❌ No property found.');
    setTimeout(() => { location.href = 'owner-dashboard.html'; }, 1000);
    return;
  }

  const sb = getSupabase();
  let rules = []; // array of { text: string }

  // Set back link
  $('btn-back').href = 'facilities.html?property=' + propertyId;

  // Load existing rules
  const { data: existingRules, error: readError } = await sb
    .from('property_rules')
    .select('*')
    .eq('property_id', propertyId)
    .order('display_order');

  if (readError) { CS.toast("Rules could not be loaded. Refresh before editing."); return; }
  if (existingRules && existingRules.length > 0) {
    rules = existingRules.map(r => ({ text: r.rule_text }));
  } else {
    // Start with one empty rule
    rules = [{ text: '' }];
  }

  renderRules();

  // ── Add rule ─────────────────────────────────────────
  $('btn-add-rule').addEventListener('click', () => {
    rules.push({ text: '' });
    renderRules();
    // Focus new input
    const inputs = document.querySelectorAll('.rule-entry input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  function renderRules() {
    const list = $('rules-list');
    list.innerHTML = rules.map((rule, i) => `
      <div class="rule-entry">
        <input type="text" value="${escapeHtml(rule.text)}" placeholder="Rule ${i + 1} — e.g. No smoking on premises" data-index="${i}">
        <button type="button" class="del-btn" data-delete="${i}" title="Remove rule">✕</button>
      </div>
    `).join('');

    // Bind input changes
    list.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        rules[parseInt(inp.dataset.index)].text = inp.value;
      });
    });

    // Bind delete buttons
    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.delete);
        rules.splice(idx, 1);
        if (rules.length === 0) rules.push({ text: '' });
        renderRules();
      });
    });
  }

  function escapeHtml(str) {
    return CS.escapeHTML(str);
  }

  // ── Save & Continue ──────────────────────────────────
  $('btn-next').addEventListener('click', async () => {
    // Filter out empty rules
    const validRules = rules.filter(r => r.text.trim().length > 0);

    const btn = $('btn-next');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      const { error } = await sb.rpc('replace_listing_details', {
        p_property: propertyId, p_section: 'rules', p_values: validRules.map(rule => rule.text.trim())
      });
      if (error) throw error;

      // Store in sessionStorage
      sessionStorage.setItem('cs:property-rules', JSON.stringify(validRules.map(r => r.text)));

      CS.toast('✅ Rules saved!');
      setTimeout(() => {
        location.href = 'review-submit.html?property=' + propertyId;
      }, 600);
    } catch (err) {
      console.error('Rules save error:', err);
      CS.toast('❌ ' + (err.message || 'Failed to save rules.'));
      btn.disabled = false;
      btn.textContent = 'Review & Submit →';
    }
  });
});
