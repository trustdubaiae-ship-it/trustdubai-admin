import{useState}from'react'
import*as XLSX from'xlsx'
import{supabase}from'../supabase'
export default function BulkUpload(){
  const[file,setFile]=useState(null)
  const[preview,setPreview]=useState([])
  const[uploading,setUploading]=useState(false)
  const[results,setResults]=useState(null)
  function parseCSV(text){
    const lines=text.trim().split('\n')
    const headers=lines[0].split(',').map(h=>h.trim().replace(/"/g,''))
    return lines.slice(1).map(line=>{
      const values=line.split(',').map(v=>v.trim().replace(/"/g,''))
      const obj={};headers.forEach((h,i)=>obj[h]=values[i]||'');return obj
    })
  }
  // Parse .xlsx/.xls (via SheetJS) or .csv → array of row objects keyed by header
  function parseFile(f){
    const isXlsx=/\.(xlsx|xls)$/i.test(f.name)
    return new Promise((resolve,reject)=>{
      const reader=new FileReader()
      reader.onerror=()=>reject(reader.error||new Error('read failed'))
      reader.onload=ev=>{
        try{
          if(isXlsx){
            const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'})
            const ws=wb.Sheets[wb.SheetNames[0]]
            // raw:false → phones/numbers come as formatted strings (no scientific notation)
            resolve(XLSX.utils.sheet_to_json(ws,{defval:'',raw:false}))
          }else{resolve(parseCSV(ev.target.result))}
        }catch(err){reject(err)}
      }
      if(isXlsx)reader.readAsArrayBuffer(f);else reader.readAsText(f)
    })
  }
  async function handleFile(e){
    const f=e.target.files[0];if(!f)return;setFile(f);setResults(null)
    try{const data=await parseFile(f);setPreview(data.slice(0,5))}
    catch(err){setPreview([]);setResults({ok:0,fail:0,dup:0,total:0,error:'Could not read file: '+err.message})}
  }
  const normName=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ')
  const normPhone=s=>String(s??'').replace(/\D/g,'')
  async function upload(){
    if(!file)return;setUploading(true)
    let data
    try{data=await parseFile(file)}
    catch(err){setResults({ok:0,fail:0,dup:0,total:0,error:'Could not read file: '+err.message});setUploading(false);return}
    // 1. Pull existing companies once to check against (name + phone)
    const{data:existing,error:exErr}=await supabase.from('companies').select('name,phone')
    if(exErr){setResults({ok:0,fail:0,dup:0,total:data.length,error:exErr.message});setUploading(false);return}
    const existingNames=new Set((existing||[]).map(c=>normName(c.name)).filter(Boolean))
    const existingPhones=new Set((existing||[]).map(c=>normPhone(c.phone)).filter(Boolean))
    // Track rows already accepted in THIS file so the file can't dupe itself
    const seenNames=new Set(),seenPhones=new Set()
    let ok=0,fail=0,dup=0
    const dupList=[]
    for(const row of data){
      const name=String(row.name||row['Company Name *']||'').trim();if(!name)continue
      const phone=String(row.phone||row['Phone *']||'').trim()
      const nk=normName(name),pk=normPhone(phone)
      // Duplicate = already in DB, or already seen earlier in this same file
      const isDup=(nk&&(existingNames.has(nk)||seenNames.has(nk)))||(pk&&(existingPhones.has(pk)||seenPhones.has(pk)))
      if(isDup){dup++;if(dupList.length<20)dupList.push(name);continue}
      const{error}=await supabase.from('companies').insert({
        name,category:row.category||row['Category *']||'',
        area:row.area||row['Area *']||'',
        description:row.description||row['Description']||'',
        phone,
        whatsapp:String(row.whatsapp||row['WhatsApp']||phone||'').trim(),
        email:row.email||row['Email']||'',
        is_verified:String(row.is_verified||row['Verified']||'').toUpperCase()==='TRUE',
        is_premium:String(row.is_premium||row['Premium']||'').toUpperCase()==='TRUE',
        status:row.status||row['Status']||'approved'
      })
      if(error){fail++}else{ok++;if(nk)seenNames.add(nk);if(pk)seenPhones.add(pk)}
    }
    setResults({ok,fail,dup,total:data.length,dupList});setUploading(false)
  }
  return(<div>
    <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:600}}>Bulk Upload</h1><p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>Add multiple companies at once via CSV</p></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
        <h2 style={{fontSize:15,fontWeight:600,marginBottom:4}}>Upload Excel / CSV</h2>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:16}}>Upload the .xlsx template directly, or a .csv file. Duplicates (same name or phone) are skipped automatically.</p>
        <label style={{display:'block',border:'2px dashed var(--border)',borderRadius:8,padding:24,textAlign:'center',cursor:'pointer',marginBottom:12}}>
          <i className="ti ti-file-spreadsheet" style={{fontSize:32,color:'var(--text3)',display:'block',marginBottom:8}}/>
          <p style={{fontSize:13,color:'var(--text2)'}}>{file?file.name:'Click to upload Excel (.xlsx) or CSV'}</p>
          <input type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={handleFile}/>
        </label>
        {preview.length>0&&<div style={{marginBottom:12,background:'var(--bg)',borderRadius:8,padding:10}}>
          <p style={{fontSize:11,fontWeight:600,color:'var(--text2)',marginBottom:6}}>Preview:</p>
          {preview.map((r,i)=><div key={i} style={{fontSize:11,color:'var(--text2)',padding:'2px 0'}}>{r.name||r['Company Name *']} — {r.category||r['Category *']} — {r.area||r['Area *']}</div>)}
        </div>}
        {results&&<div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:12,marginBottom:12}}>
          {results.error
            ?<p style={{fontSize:13,color:'var(--red)',fontWeight:500}}>✗ Error: {results.error}</p>
            :<>
              <p style={{fontSize:13,color:'var(--green)',fontWeight:600}}>✓ {results.ok} new companies added</p>
              {results.dup>0&&<p style={{fontSize:12,color:'var(--text2)',marginTop:4}}>⊘ {results.dup} skipped — already exist (duplicate name or phone)</p>}
              {results.fail>0&&<p style={{fontSize:12,color:'var(--red)',marginTop:4}}>✗ {results.fail} failed (missing/invalid data)</p>}
              <p style={{fontSize:11,color:'var(--text3)',marginTop:6}}>Total rows in file: {results.total}</p>
              {results.dupList&&results.dupList.length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                <p style={{fontSize:11,fontWeight:600,color:'var(--text2)',marginBottom:4}}>Skipped as duplicate:</p>
                <p style={{fontSize:11,color:'var(--text3)',lineHeight:1.6}}>{results.dupList.join(', ')}{results.dup>results.dupList.length?` …and ${results.dup-results.dupList.length} more`:''}</p>
              </div>}
            </>}
        </div>}
        <button onClick={upload} disabled={!file||uploading} style={{width:'100%',padding:10,background:!file||uploading?'var(--text3)':'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'}}>
          {uploading?'Uploading...':'Upload Companies'}
        </button>
      </div>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
        <h2 style={{fontSize:15,fontWeight:600,marginBottom:4}}>Direct SQL</h2>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:16}}>For large batches, use Supabase SQL Editor directly</p>
        <a href="https://supabase.com/dashboard/project/ribdorraxxhfbfkjhpie/sql/new" target="_blank" rel="noreferrer"
          style={{display:'block',padding:12,background:'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,textAlign:'center',textDecoration:'none',marginBottom:16}}>
          Open Supabase SQL Editor ↗
        </a>
        <div style={{background:'var(--bg)',borderRadius:8,padding:12}}>
          <p style={{fontSize:12,fontWeight:600,color:'var(--text2)',marginBottom:8}}>SQL Template:</p>
          <code style={{fontSize:11,color:'var(--text)',display:'block',lineHeight:1.6}}>
            INSERT INTO companies (name, category, area, phone, whatsapp, status)<br/>
            VALUES ('Company Name', 'AC Service', 'JVC', '+97150...', '+97150...', 'approved');
          </code>
        </div>
      </div>
    </div>
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:20,marginTop:16}}>
      <h2 style={{fontSize:15,fontWeight:600,marginBottom:12}}>Steps</h2>
      {[['1','Fill Excel Template','Open Quvera_Company_Seed_Template.xlsx and fill the rows'],['2','Upload directly','Click the upload box above and pick the .xlsx file (no need to convert to CSV)'],['3','Duplicates auto-skipped','Companies already in the DB, or repeated in the file, are skipped'],['4','Verify','Check Companies → Approved tab']].map(([n,t,d])=>(
        <div key={n} style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,flexShrink:0}}>{n}</div>
          <div><div style={{fontSize:13,fontWeight:500}}>{t}</div><div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{d}</div></div>
        </div>
      ))}
    </div>
  </div>)
}
