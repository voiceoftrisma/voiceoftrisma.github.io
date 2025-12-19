function getIdentifierFromDetailsUrl(url){
  try{
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('details');
    if(idx !== -1 && parts[idx+1]) return parts[idx+1];
  }catch(e){}
  return null;
}

async function resolveMp3Url(identifier){
  const metaUrl = `https://archive.org/metadata/${identifier}`;
  const res = await fetch(metaUrl);
  if(!res.ok) throw new Error('Gagal ambil metadata');
  const meta = await res.json();
  const files = meta.files || [];
  const candidate = files.find(f => (f.format||'').toLowerCase().includes('mp3'))
                  || files.find(f => (f.name||'').toLowerCase().endsWith('.mp3'));
  if(!candidate) return null;
  return `https://archive.org/download/${identifier}/${encodeURIComponent(candidate.name)}`;
}

function formatDate(isoDate){
  try{
    const d = new Date(isoDate);
    const dd = String(d.getUTCDate()).padStart(2,'0');
    const mm = String(d.getUTCMonth()+1).padStart(2,'0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }catch(e){ return isoDate; }
}

// Helper: extract base date from title (e.g., "VOT-Denpasar_13-10-25" from "VOT-Denpasar_13-10-25-2.mp3")
function extractBaseDate(title) {
  const match = title.match(/VOT-Denpasar_(\d{2}-\d{2}-\d{2})/);
  return match ? `VOT-Denpasar_${match[1]}` : title;
}

// Helper to extract datetime string from identifier for sorting
function extractDateTimeFromId(id) {
  if (!id) return '';
  // Example id: vot-denpasar-20250908-172707
  const match = id.match(/(\d{8}-\d{6})/);
  return match ? match[1] : '';
}
