import{useState}from'react'
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
  function handleFile(e){
    const f=e.target.files[0];if(!f)return;setFile(f)
    const reader=new FileReader()
    reader.onload=ev=>{const data=parseCSV(ev.target.result);setPreview(data.slice(0,5))}
    reader.readAsText(f)
  }
  async function upload(){
    if(!file)return;setUploading(true)
    const reader=new FileReader()
    reader.onload=async ev=>{
      const data=parseCSV(ev.target.result)
      let ok=0,fail=0
      for(const row of data){
        const name=row.name||row['Company Name *'];if(!name)continue
        const{error}=await supabase.from('companies').insert({
          name,category:row.category||row['Category *']||'',
          area:row.area||row['Area *']||'',
          description:row.description||row['Description']||'',
          phone:row.phone||row['Phone *']||'',
          whatsapp:row.whatsapp||row['WhatsApp']||row.phone||'',
          email:row.email||row['Email']||'',
          is_verified:(row.is_verified||row['Verified'])==='TRUE',
          is_premium:(row.is_premium||row['Premium'])==='TRUE',
          status:row.status||row['Status']||'approved'
        })
        if(error)fail++;else ok++
      }
      setResults({ok,fail,total:data.length});setUploading(false)
    }
    reader.readAsText(file)
  }
  return(<div>
    <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:600}}>Bulk Upload</h1><p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>Add multiple companies at once via CSV</p></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
        <h2 style={{fontSize:15,fontWeight:600,marginBottom:4}}>Upload CSV</h2>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:16}}>Save Excel template as CSV and upload here</p>
        <label style={{display:'block',border:'2px dashed var(--border)',borderRadius:8,padding:24,textAlign:'center',cursor:'pointer',marginBottom:12}}>
          <i className="ti ti-file-spreadsheet" style={{fontSize:32,color:'var(--text3)',display:'block',marginBottom:8}}/>
          <p style={{fontSize:13,color:'var(--text2)'}}>{file?file.name:'Click to upload CSV'}</p>
          <input type="file" accept=".csv" style={{display:'none'}} onChange={handleFile}/>
        </label>
        {preview.length>0&&<div style={{marginBottom:12,background:'var(--bg)',borderRadius:8,padding:10}}>
          <p style={{fontSize:11,fontWeight:600,color:'var(--text2)',marginBottom:6}}>Preview:</p>
          {preview.map((r,i)=><div key={i} style={{fontSize:11,color:'var(--text2)',padding:'2px 0'}}>{r.name||r['Company Name *']} — {r.category||r['Category *']} — {r.area||r['Area *']}</div>)}
        </div>}
        {results&&<div style={{background:'var(--green-light)',borderRadius:8,padding:12,marginBottom:12}}>
          <p style={{fontSize:13,color:'var(--green)',fontWeight:500}}>✓ {results.ok} companies added!</p>
          {results.fail>0&&<p style={{fontSize:12,color:'var(--red)',marginTop:4}}>{results.fail} failed (duplicates)</p>}
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
      {[['1','Fill Excel Template','Open TrustDubai_Company_Seed_Template.xlsx'],['2','Save as CSV','File → Save As → CSV format'],['3','Upload','Click Upload CSV above'],['4','Verify','Check Companies → Approved tab']].map(([n,t,d])=>(
        <div key={n} style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,flexShrink:0}}>{n}</div>
          <div><div style={{fontSize:13,fontWeight:500}}>{t}</div><div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{d}</div></div>
        </div>
      ))}
    </div>
  </div>)
}
