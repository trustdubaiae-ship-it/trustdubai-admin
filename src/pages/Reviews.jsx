import{useState,useEffect}from'react'
import{supabase}from'../supabase'
export default function Reviews(){
  const[reviews,setReviews]=useState([])
  const[loading,setLoading]=useState(true)
  const[filter,setFilter]=useState('all')
  useEffect(()=>{fetch()},[])
  async function fetch(){
    setLoading(true)
    const{data}=await supabase.from('reviews').select('*,companies(name)').order('created_at',{ascending:false})
    setReviews(data||[])
    setLoading(false)
  }
  async function toggle(id,cur){await supabase.from('reviews').update({is_approved:!cur}).eq('id',id);fetch()}
  async function del(id){if(!confirm('Delete?'))return;await supabase.from('reviews').delete().eq('id',id);fetch()}
  const filtered=filter==='all'?reviews:reviews.filter(r=>filter==='approved'?r.is_approved:!r.is_approved)
  return(<div>
    <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:600}}>Reviews</h1><p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>Moderate all platform reviews</p></div>
    <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'1px solid var(--border)'}}>
      {['all','approved','pending'].map(f=>(
        <button key={f} onClick={()=>setFilter(f)} style={{padding:'10px 20px',border:'none',background:'none',borderBottom:filter===f?'2px solid var(--primary)':'2px solid transparent',color:filter===f?'var(--primary)':'var(--text2)',fontWeight:500,fontSize:13,textTransform:'capitalize',cursor:'pointer'}}>{f}</button>
      ))}
    </div>
    {loading?<p style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Loading...</p>:
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {filtered.map(r=>(
        <div key={r.id} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <div><span style={{fontSize:13,fontWeight:500}}>{r.companies?.name||'Unknown'}</span><span style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>by {r.reviewer_name}</span></div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{color:'var(--amber)',fontSize:13}}>{'★'.repeat(r.rating)}</span>
              <span style={{fontSize:11,color:'var(--text3)'}}>{new Date(r.created_at).toLocaleDateString()}</span>
              <span style={{background:r.is_approved?'var(--green-light)':'var(--red-light)',color:r.is_approved?'var(--green)':'var(--red)',fontSize:11,padding:'2px 8px',borderRadius:10}}>{r.is_approved?'Approved':'Hidden'}</span>
            </div>
          </div>
          <p style={{fontSize:13,color:'var(--text2)',marginBottom:10,lineHeight:1.5}}>{r.review_text}</p>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>toggle(r.id,r.is_approved)} style={{padding:'5px 12px',borderRadius:6,border:'none',fontSize:12,fontWeight:500,cursor:'pointer',background:r.is_approved?'var(--amber-light)':'var(--green-light)',color:r.is_approved?'var(--amber)':'var(--green)'}}>{r.is_approved?'Hide':'Approve'}</button>
            <button onClick={()=>del(r.id)} style={{padding:'5px 12px',borderRadius:6,border:'none',fontSize:12,cursor:'pointer',background:'var(--red-light)',color:'var(--red)'}}>Delete</button>
          </div>
        </div>
      ))}
      {filtered.length===0&&<p style={{textAlign:'center',padding:40,color:'var(--text3)',fontSize:13}}>No reviews</p>}
    </div>}
  </div>)
}
