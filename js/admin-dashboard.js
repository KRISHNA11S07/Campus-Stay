document.addEventListener('cs:auth-ready', async () => {
  const sb=getSupabase(), $=id=>document.getElementById(id);
  const el=(tag,text)=>{const node=document.createElement(tag); node.textContent=text ?? ''; return node;};
  let page=0, busy=false;
  const size=20;
  const fields={owner_applications:'*',reports:'*',account_deletion_requests:'*',platform_audit:'*',
    properties:'id,title,type,owner_id,area,city,distance_km,accommodation_type,rent,rent_period,deposit,owner_name,owner_phone,description,created_at,updated_at,listing_status,property_media(storage_path,display_order),property_rules(rule_text),property_facilities(facilities(label))'};
  async function metrics(){
    const items=[['Student accounts','profiles','role','student'],['Owner applicants','owner_applications'],['Approved owners','owner_applications','status','approved'],
      ['Pending applications','owner_applications','status','pending'],['Properties','properties'],['Pending listings','properties','listing_status','pending'],
      ['Published listings','properties','listing_status','published'],['Rejected listings','properties','listing_status','rejected'],['New reports','reports','status','new']];
    const counts=await Promise.all(items.map(async ([label,table,col,value])=>{
      let q=sb.from(table).select('*',{head:true,count:'exact'}); if(col) q=q.eq(col,value);
      const {count,error}=await q;if(error) throw error;return el('p',label+' · '+count);
    })); $('metrics').replaceChildren(...counts);
  }
  function actions(table,row){
    if(table==='owner_applications') return ({pending:['approved','clarification','rejected'],approved:['suspended'],suspended:['clarification']})[row.status]||[];
    if(table==='properties') return ({pending:['published','rejected'],published:['paused']})[row.listing_status]||[];
    if(table==='reports') return ['reviewed','resolved','dismissed'].filter(v=>v!==row.status);
    return [];
  }
  async function load(){
    busy=true; const table=$('queue').value; $('queue').disabled=$('previous').disabled=$('next').disabled=true;
    $('records').replaceChildren(); $('status').textContent='Loading records…';
    try {
      const order=({owner_applications:'applicant_id',platform_audit:'id',account_deletion_requests:'requested_at'})[table]||'created_at';
      const {data,error}=await sb.from(table).select(fields[table]).order(order,{ascending:false}).range(page*size,(page+1)*size);
      if(error) throw error;
      for(const row of data.slice(0,size)){
        const card=el('article'); card.className='account-surface wizard-panel active';
        const id=row.applicant_id||row.user_id||row.id;
        card.append(el('h2',row.full_name||row.title||row.action||(row.user_id?'Deletion request':'Report')),el('p',String(id)));
        if(table==='properties'){
          const owner=await sb.from('owner_applications').select('status').eq('applicant_id',row.owner_id).maybeSingle();
          if(owner.error) throw owner.error;
          card.append(el('p','Owner verification · '+(owner.data?.status||'Unverified')));
          card.append(el('p',(row.property_rules||[]).map(x=>x.rule_text).join(' · ')),el('p',(row.property_facilities||[]).map(x=>x.facilities?.label).join(' · ')));
          for(const media of await resolveMediaUrls(row.property_media)){
            if(!media.file_url)continue;const img=el('img');img.src=media.file_url;img.width=140;img.alt='Submitted property photo';card.append(img);
          }
        }
        for(const [key,value] of Object.entries(row)){
          if(value==null || typeof value==='object' || key==='id')continue;
          card.append(el('p',key.replaceAll('_',' ')+' · '+value));
        }
        for(const state of actions(table,row)){
          const button=el('button',table==='properties' && state==='rejected' ? 'Return for corrections' : state); button.className='btn btn-ghost'; card.append(button);
          button.onclick=async()=>{
            if(busy)return;
            const reason=prompt('Reason for marking this record '+state+'?');if(!reason?.trim()||!confirm('Confirm this decision?'))return;
            busy=true; button.disabled=true;
            try{
              const result=table==='owner_applications'?await sb.rpc('review_owner_application',{p_applicant:id,p_status:state,p_reason:reason,p_revision:row.revision}):
                await sb.rpc('moderate_record',{p_kind:table==='reports'?'report':'listing',p_id:id,p_state:state,p_reason:reason,p_reviewed_at:row.updated_at});
              if(result.error)throw result.error;
              await load();
            } catch { $('status').textContent='Decision could not be confirmed. Refresh before retrying.';}
            finally{busy=false;button.disabled=false;}
          };
        }
        $('records').append(card);
      }
      await metrics();
      $('previous').disabled=page===0; $('next').disabled=data.length<=size;
      $('status').textContent=data.length?'Page '+(page+1):'No records in this queue.';
    } catch { $('status').textContent='Could not load authorized records. Refresh to retry.';}
    finally {busy=false;$('queue').disabled=false;}
  }
  $('queue').onchange=()=>{page=0;load();};$('previous').onclick=()=>{if(!busy){page--;load();}};$('next').onclick=()=>{if(!busy){page++;load();}};
  await load();
});
