import{useState,useEffect}from'react'
import{supabase}from'../supabase'
const CATS=['Interior Design','Renovation','Technical Contracting','Fit-Out','AC Service','Plumbing','Electrical','Cleaning','Painting','Handyman']
function Modal({title,onClose,children}){
  return(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
    <div style={{background:'#fff',borderRadius:12,padding:24,width:480,maxHeight:'80vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
        <h2 style={{fontSize:16,fontWeight:600}}>{title}</h2>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--text3)'}}>×</button>
      </div>
      {children}
    </div>
  </div>)
}
function Field({label,value,onChange}){
  return(<div style={{marginBottom:12}}>
    <label style={{fontSize:12,fontWeight:500,color:'var(--text2)',display:'block',marginBottom:4,textTransform:'capitalize'}}>{label}</label>
    <input value={value||''} onChange={e=>onChange(e.target.value)} style={{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:13,outline:'none'}}/>
  </div>)
}
export default function Companies(){
  const[tab,setTab]=useState('pending')
  const[companies,setCompanies]=useState([])
  const[regs,setRegs]=useState([])
  const[loading,setLoading]=useState(true)
  const[editC,setEditC]=useState(null)
  const[addModal,setAddModal]=useState(false)
  const[newC,setNewC]=useState({name:'',category:'',area:'',phone:'',whatsapp:'',email:'',description:''})
  useEffect(()=>{fetchAll()},[])
  async function fetchAll(){
    setLoading(true)
    const[c,r]=await Promise.all([
      supabase.from('companies').select('*').order('created_at',{ascending:false}),
      supabase.from('company_registrations').select('*').order('submitted_at',{ascending:false})
    ])
    setCompanies(c.data||[]);setRegs(r.data||[]);setLoading(false)
  }
  async function approve(reg){
    await supabase.from('companies').insert({name:reg.company_name,category:reg.category,area:reg.area,phone:reg.phone,whatsapp:reg.phone,email:reg.email||'',status:'approved',is_verified:false,is_premium:false})
    await supabase.from('company_registrations').update({status:'approved'}).eq('id',reg.id)
    fetchAll()
  }
  async function reject(id){await supabase.from('company_registrations').update({status:'rejected'}).eq('id',id);fetchAll()}
  async function update(id,updates){await supabase.from('companies').update(updates).eq('id',id);fetchAll();setEditC(null)}
  async function del(id){if(!confirm('Delete?'))return;await supabase.from('companies').delete().eq('id',id);fetchAll()}
  async function addNew(){
    await supabase.from('companies').insert({...newC,status:'approved'})
    setAddModal(false);setNewC({name:'',category:'',area:'',phone:'',whatsapp:'',email:'',description:''});fetchAll()
  }
  const pending=regs.filter(r=>r.status==='pending')
  const approved=companies.filter(c=>c.status==='approved')
  const btn=(color,bg)=>({padding:'5px 12px',borderRadius:6,border:'none',fontSize:12,fontWeight:500,cursor:'pointer',color,background:bg})
  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
      <div><h1 style={{fontSize:22,fontWeight:600}}>Companies</h1><p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>Manage all listings</p></div>
      <button onClick={()=>setAddModal(true)} style={{padding:'8px 16px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'}}>+ Add Company</button>
    </div>
    <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'1px solid var(--border)'}}>
      {[{id:'pending',label:`Pending (${pending.length})`},{id:'approved',label:`Approved (${approved.length})`},{id:'all',label:`All (${companies.length})`}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 20px',border:'none',background:'none',borderBottom:tab===t.id?'2px solid var(--primary)':'2px solid transparent',color:tab===t.id?'var(--primary)':'var(--text2)',fontWeight:500,fontSize:13,cursor:'pointer'}}>{t.label}</button>
      ))}
    </div>
    {loading?<p style={{textAlign:'center',color:'var(--text3)',padding:40}}>Loading...</p>:(
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{background:'var(--bg)'}}>
          {['Company','Category','Area','Phone','Status','Actions'].map(h=>(
            <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'var(--text2)',borderBottom:'1px solid var(--border)'}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {tab==='pending'&&pending.map(r=>(
            <tr key={r.id} style={{borderBottom:'1px solid var(--border)'}}>
              <td style={{padding:'12px 16px'}}><div style={{fontSize:13,fontWeight:500}}>{r.company_name}</div><div style={{fontSize:11,color:'var(--text3)'}}>{r.email}</div></td>
              <td style={{padding:'12px 16px',fontSize:13}}>{r.category}</td>
              <td style={{padding:'12px 16px',fontSize:13}}>{r.area}</td>
              <td style={{padding:'12px 16px',fontSize:13}}>{r.phone}</td>
              <td style={{padding:'12px 16px'}}><span style={{background:'var(--amber-light)',color:'var(--amber)',fontSize:11,padding:'2px 8px',borderRadius:10}}>Pending</span></td>
              <td style={{padding:'12px 16px'}}><div style={{display:'flex',gap:6}}><button onClick={()=>approve(r)} style={btn('#fff','var(--green)')}>Approve</button><button onClick={()=>reject(r.id)} style={btn('#fff','var(--red)')}>Reject</button></div></td>
            </tr>
          ))}
          {(tab==='approved'?approved:tab==='all'?companies:[]).map(c=>(
            <tr key={c.id} style={{borderBottom:'1px solid var(--border)'}}>
              <td style={{padding:'12px 16px'}}><div style={{fontSize:13,fontWeight:500}}>{c.name}</div><div style={{fontSize:11,color:'var(--text3)'}}>{c.email}</div></td>
              <td style={{padding:'12px 16px',fontSize:13}}>{c.category}</td>
              <td style={{padding:'12px 16px',fontSize:13}}>{c.area}</td>
              <td style={{padding:'12px 16px',fontSize:13}}>{c.phone}</td>
              <td style={{padding:'12px 16px'}}>
                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  <span style={{background:c.status==='approved'?'var(--green-light)':'var(--amber-light)',color:c.status==='approved'?'var(--green)':'var(--amber)',fontSize:11,padding:'2px 8px',borderRadius:10,display:'inline-block'}}>{c.status}</span>
                  {c.is_verified&&<span style={{background:'#e8f0fe',color:'var(--primary)',fontSize:11,padding:'2px 8px',borderRadius:10,display:'inline-block'}}>✓ Verified</span>}
                  {c.is_premium&&<span style={{background:'var(--amber-light)',color:'var(--amber)',fontSize:11,padding:'2px 8px',borderRadius:10,display:'inline-block'}}>⭐ Premium</span>}
                </div>
              </td>
              <td style={{padding:'12px 16px'}}>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  <button onClick={()=>setEditC(c)} style={btn('var(--primary)','var(--primary-light)')}>Edit</button>
                  <button onClick={()=>update(c.id,{is_verified:!c.is_verified})} style={btn('var(--green)','var(--green-light)')}>{c.is_verified?'Unverify':'Verify'}</button>
                  <button onClick={()=>update(c.id,{is_premium:!c.is_premium})} style={btn('var(--amber)','var(--amber-light)')}>{c.is_premium?'Free':'Premium'}</button>
                  <button onClick={()=>del(c.id)} style={btn('var(--red)','var(--red-light)')}>Del</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>)}
    {editC&&<Modal title="Edit Company" onClose={()=>setEditC(null)}>
      {['name','area','phone','whatsapp','email','description'].map(f=><Field key={f} label={f} value={editC[f]} onChange={v=>setEditC({...editC,[f]:v})}/>)}
      <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:500,color:'var(--text2)',display:'block',marginBottom:4}}>Category</label>
        <select value={editC.category||''} onChange={e=>setEditC({...editC,category:e.target.value})} style={{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:13,background:'#fff'}}>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select></div>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button onClick={()=>update(editC.id,editC)} style={{flex:1,padding:10,background:'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>Save</button>
        <button onClick={()=>setEditC(null)} style={{flex:1,padding:10,background:'var(--bg)',color:'var(--text2)',border:'1px solid var(--border)',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancel</button>
      </div>
    </Modal>}
    {addModal&&<Modal title="Add New Company" onClose={()=>setAddModal(false)}>
      {['name','area','phone','whatsapp','email','description'].map(f=><Field key={f} label={f} value={newC[f]} onChange={v=>setNewC({...newC,[f]:v})}/>)}
      <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:500,color:'var(--text2)',display:'block',marginBottom:4}}>Category</label>
        <select value={newC.category} onChange={e=>setNewC({...newC,category:e.target.value})} style={{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:13,background:'#fff'}}>
          <option value="">Select category</option>{CATS.map(c=><option key={c}>{c}</option>)}
        </select></div>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button onClick={addNew} style={{flex:1,padding:10,background:'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>Add Company</button>
        <button onClick={()=>setAddModal(false)} style={{flex:1,padding:10,background:'var(--bg)',color:'var(--text2)',border:'1px solid var(--border)',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancel</button>
      </div>
    </Modal>}
  </div>)
}
