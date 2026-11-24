document.addEventListener('cs:auth-ready', async ({detail:{profile,user}}) => {
  if (profile.role === 'admin' || (profile.role === 'owner' && !new URLSearchParams(location.search).has('status'))) {
    location.replace(profile.role === 'admin' ? 'admin-dashboard.html' : 'owner-dashboard.html');
    return;
  }
  const form = document.getElementById('application');
  const status = document.getElementById('status');
  const sb = getSupabase();
  async function load() {
    const {data,error} = await sb.from('owner_applications').select('*').eq('applicant_id',user.id).maybeSingle();
    if (error) {status.textContent='Your application could not be loaded. Refresh to retry.'; return;}
    const state = data?.status;
    status.textContent = ({draft:'Your draft is saved.',pending:'Your owner application is under review.',
      approved:'Your owner application is approved.',clarification:'The reviewer needs more information.',rejected:'Your application was declined. You can update and resubmit.',
      suspended:'Your owner access is suspended.'})[state] || 'Apply to list accommodation near KIT.';
    if (data?.submitted_at) status.textContent += ' Submitted '+new Date(data.submitted_at).toLocaleDateString()+'.';
    document.getElementById('feedback').textContent = data?.feedback || '';
    for (const key of ['full_name','relationship','property_address','authority_evidence'])
      form.elements[key].value = data?.[key] || (key==='full_name'?profile.full_name || '':key==='relationship'?'owner':'');
    form.hidden = ['pending','suspended','approved'].includes(state);
  }
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const submit=e.submitter?.value!=='draft';
    const buttons=[...form.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
    try {
      const value=k=>form.elements[k].value.trim();
      const {error}=await sb.rpc('save_owner_application',{p_name:value('full_name'),p_relationship:value('relationship'),
        p_address:value('property_address'),p_evidence:value('authority_evidence'),p_submit:submit});
      if(error) throw error;
      await load();
    } catch {status.textContent='Could not save. Confirm your account contact, enter the address and a checkable authority reference, then retry.';}
    finally {buttons.forEach(b=>b.disabled=false);}
  });
  await load();
});
