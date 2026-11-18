/* ============================================================
   CampusStay — Owner Inquiries Management
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  const user = await getCurrentUser();
  const profile = await getProfile();
  if (!user || !profile) return;

  const listEl = $('inquiries-list');
  const emptyEl = $('empty-state');
  const paginationEl = $('pagination');
  const pageInfoEl = $('page-info');
  const modal = $('inquiry-modal');
  const modalClose = modal.querySelector('.modal-close');
  const modalCloseBtn = $('modal-close-btn');
  const modalBody = $('modal-body');
  const modalStatusSelect = $('modal-status-select');
  const modalUpdateStatus = $('modal-update-status');
  const modalContactStudent = $('modal-contact-student');

  let allInquiries = [];
  let currentFilter = 'all';
  let currentPage = 1;
  const pageSize = 10;
  let currentInquiryId = null;

  const STATUS_LABELS = {
    new: 'New',
    contacted: 'Contacted',
    responded: 'Responded',
    closed: 'Closed'
  };

  async function loadInquiries() {
    const sb = getSupabase();
    if (!sb) return;

    try {
      const { data, error } = await sb
        .from('inquiries')
        .select('*, properties(title, area, city, type)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      allInquiries = data || [];
      render();
    } catch (err) {
      console.error('[Inquiries] Load failed:', err);
      listEl.innerHTML = `
        <div class="empty-state glass" style="padding:2rem; text-align:center;">
          <div class="big">⚠️</div>
          <h3>Error loading inquiries</h3>
          <p style="color:var(--text-2);">${err.message}</p>
        </div>`;
    }
  }

  function render() {
    const filtered = allInquiries.filter(q =>
      currentFilter === 'all' || q.status === currentFilter
    );

    pageInfoEl.textContent = `Showing ${filtered.length} inquiry${filtered.length !== 1 ? 'ies' : ''}`;

    if (filtered.length === 0) {
      listEl.hidden = true;
      emptyEl.hidden = false;
      paginationEl.hidden = true;
      return;
    }

    listEl.hidden = false;
    emptyEl.hidden = true;
    paginationEl.hidden = false;

    // Pagination
    const totalPages = Math.ceil(filtered.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages} — ${filtered.length} inquiry${filtered.length !== 1 ? 'ies' : ''}`;

    const sb = getSupabase();

    listEl.innerHTML = pageItems.map((inq) => {
      const prop = inq.properties || {};
      const statusClass = `status-${inq.status}`;
      const contactBtn = inq.status === 'new' || inq.status === 'contacted'
        ? `<button class="btn btn-ghost btn-sm contact-student-btn" data-inquiry-id="${inq.id}" data-student-name="${escapeHTML(inq.student_name || 'Student')}" data-student-phone="${escapeHTML(inq.student_phone || '')}" title="Contact student">💬 Contact</button>`
        : '';

      return `
        <div class="inquiry-card glass" data-inquiry-id="${inq.id}">
          <div class="inquiry-header">
            <div class="inquiry-property">
              <span class="inquiry-property-title">${escapeHTML(prop.title || 'Untitled property')}</span>
              <span class="inquiry-property-area">📍 ${escapeHTML(prop.area || '')}${prop.city ? ' · ' + escapeHTML(prop.city) : ''}</span>
              <span class="inquiry-property-type">${escapeHTML(prop.type || '')}</span>
            </div>
            <span class="inquiry-status status-badge ${statusClass}">${STATUS_LABELS[inq.status] || inq.status}</span>
          </div>
          <div class="inquiry-body">
            <div class="inquiry-student">
              <span class="inquiry-student-name">${escapeHTML(inq.student_name || 'A student')}</span>
              ${inq.student_phone ? `<span class="inquiry-student-phone">📞 ${escapeHTML(inq.student_phone)}</span>` : ''}
            </div>
            <div class="inquiry-message">${escapeHTML(inq.message || '')}</div>
            <div class="inquiry-meta">
              <span>• ${new Date(inq.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              ${contactBtn}
            </div>
          </div>
        </div>`;
    }).join('');

    // Bind contact buttons
    listEl.querySelectorAll('.contact-student-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentName = btn.dataset.studentName;
        const studentPhone = btn.dataset.studentPhone;
        if (studentPhone) {
          const waMessage = encodeURIComponent(`Hi ${studentName}, I'm responding to your inquiry on CampusStay about a property. Is it still available?`);
          window.open(`https://wa.me/${studentPhone.replace(/[^0-9]/g, '')}?text=${waMessage}`, '_blank');
        } else {
          CS.toast('No phone number available for this student.');
        }
      });
    });

    // Bind card click to open detail modal
    listEl.querySelectorAll('.inquiry-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.contact-student-btn')) return;
        const inquiryId = card.dataset.inquiryId;
        openInquiryDetail(inquiryId);
      });
    });
  }

  async function openInquiryDetail(inquiryId) {
    const inq = allInquiries.find(i => i.id === inquiryId);
    if (!inq) return;
    currentInquiryId = inquiryId;

    modalStatusSelect.value = inq.status;
    modalBody.innerHTML = `
      <div class="detail-row">
        <label>Property</label>
        <span>${escapeHTML((inq.properties && inq.properties.title) || 'Untitled property')}</span>
      </div>
      <div class="detail-row">
        <label>Student</label>
        <span>${escapeHTML(inq.student_name || 'A student')}</span>
      </div>
      <div class="detail-row">
        <label>Contact</label>
        <span>${inq.student_phone || 'Not provided'}</span>
      </div>
      <div class="detail-row">
        <label>Message</label>
        <p style="white-space:pre-wrap; color:var(--text-2);">${escapeHTML(inq.message || '')}</p>
      </div>
      <div class="detail-row">
        <label>Status</label>
        <span>${STATUS_LABELS[inq.status] || inq.status}</span>
      </div>
      <div class="detail-row">
        <label>Sent</label>
        <span>${new Date(inq.created_at).toLocaleString('en-IN')}</span>
      </div>
    `;

    modalContactStudent.hidden = false;
    modalContactStudent.onclick = () => {
      if (inq.student_phone) {
        const waMessage = encodeURIComponent(`Hi ${inq.student_name}, I'm responding to your inquiry on CampusStay about "${inq.properties?.title || 'a property'}". Is it still available?`);
        window.open(`https://wa.me/${inq.student_phone.replace(/[^0-9]/g, '')}?text=${waMessage}`, '_blank');
      } else {
        CS.toast('No phone number available for this student.');
      }
    };

    modal.showModal();
  }

  async function updateInquiryStatus(newStatus) {
    if (!currentInquiryId) return;
    const sb = getSupabase();
    if (!sb) return;

    try {
      const { error } = await sb
        .from('inquiries')
        .update({ status: newStatus })
        .eq('id', currentInquiryId);

      if (error) throw error;

      // Update local state
      const inq = allInquiries.find(i => i.id === currentInquiryId);
      if (inq) inq.status = newStatus;
      modalStatusSelect.value = newStatus;
      CS.toast(`Status updated to ${STATUS_LABELS[newStatus]}`);
      render();
    } catch (err) {
      console.error('[Inquiries] Update failed:', err);
      CS.toast('Failed to update status.');
    }
  }

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t === tab));
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      render();
    });
  });

  // Pagination
  $('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  });
  $('next-page').addEventListener('click', () => {
    const filtered = allInquiries.filter(q => currentFilter === 'all' || q.status === currentFilter);
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      render();
    }
  });

  // Modal controls
  modalClose.addEventListener('click', () => modal.close());
  modalCloseBtn.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  modalUpdateStatus.addEventListener('click', () => {
    updateInquiryStatus(modalStatusSelect.value);
  });

  loadInquiries();
});

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}