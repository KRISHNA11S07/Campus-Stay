/* The owner opens the third-party map explicitly. Manual coordinates work offline. */
function initPropertyLocation(onEdit) {
  const field = id => document.getElementById(id);
  const lat = field('property-lat'), lng = field('property-lng');
  const message = field('location-message'), summary = field('location-summary');
  const confirm = field('confirm-location'), open = field('open-map');
  const container = field('location-map');
  const point = () => ({lat:lat.value,lng:lng.value});
  let map, marker, loading;
  function preview(edited = false) {
    const coordinates = point(), valid = CS.validCoordinates(coordinates);
    confirm.parentElement.hidden = !valid;
    if (edited) { confirm.checked = false; onEdit(); }
    if (marker && !valid) { marker.remove(); marker = null; }
    summary.textContent = '';
    if (!valid) return;
    const distance = CS.haversineKm(COLLEGES[0],coordinates);
    summary.textContent = [field('property-area').value.trim(),coordinates.lat+', '+coordinates.lng,distance.toFixed(2)+' km from KIT'].filter(Boolean).join(' · ');
    if (map) {
      if (!marker) {
        marker = L.marker(coordinates,{draggable:true,title:'Property location'}).addTo(map);
        marker.on('dragend', () => setPoint(marker.getLatLng()));
      } else marker.setLatLng(coordinates);
      map.panTo(coordinates);
    }
  }
  function setPoint(p) {
    lat.value = p.lat.toFixed(6);
    lng.value = p.lng.toFixed(6);
    preview(true);
  }
  [lat,lng,field('property-area')].forEach(input => input.addEventListener('input',() => preview(true)));
  field('manual-location').onclick = () => { lat.focus(); message.textContent = 'Enter the property coordinates or provide the locality and campus distance.'; };
  const locate = field('allow-location');
  locate.onclick = () => {
    if (!navigator.geolocation) { message.textContent = 'Location is unavailable in this browser. Enter the location manually.'; return; }
    locate.disabled = true;
    message.textContent = 'Finding this device…';
    navigator.geolocation.getCurrentPosition(p => {
      locate.disabled = false;
      setPoint({lat:p.coords.latitude,lng:p.coords.longitude});
      const accuracy = Number.isFinite(p.coords.accuracy) ? ' (accuracy about '+Math.round(p.coords.accuracy)+' m)' : '';
      message.textContent = 'Device location found'+accuracy+'. Adjust the coordinates if the property is elsewhere.';
    }, error => {
      locate.disabled = false;
      message.textContent = ({1:'Location permission was denied.',2:'The device could not determine its position.',3:'The location request timed out.'}[error.code] || 'Location unavailable.')+' Choose a point on the map or enter coordinates.';
    },{enableHighAccuracy:true,timeout:10000});
  };
  function asset(tag,path,integrity) {
    return new Promise((resolve,reject) => {
      const el = document.createElement(tag);
      if (tag === 'link') { el.rel='stylesheet'; el.href=path; }
      else el.src=path;
      el.integrity=integrity;
      el.crossOrigin='anonymous';
      el.onload=resolve;
      el.onerror=()=>{ el.remove(); reject(new Error('Map asset unavailable')); };
      document.head.append(el);
    });
  }
  open.onclick = async () => {
    open.disabled = true;
    message.textContent = 'Loading map…';
    try {
      const base = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.';
      loading ||= Promise.all([asset('link',base+'css','sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='),asset('script',base+'js','sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=')]);
      await loading;
      container.hidden=false;
      map=L.map(container).setView(CS.validCoordinates(point()) ? point() : COLLEGES[0],15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).on('tileerror',()=>{message.textContent='Some map tiles are unavailable. You can still enter the coordinates manually.';}).addTo(map);
      map.on('click',e=>setPoint(e.latlng));
      preview();
      message.textContent='Select the property on the map. Drag the pin or edit its coordinates to adjust it.';
      open.hidden=true;
    } catch {
      loading=null;
      open.disabled=false;
      container.hidden=true;
      message.textContent='The map could not load. Retry or enter the address and coordinates manually.';
    }
  };
  return {preview, point, resize:()=>map?.invalidateSize()};
}
