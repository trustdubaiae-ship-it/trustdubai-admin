import{useState,useEffect}from'react'
import{supabase}from'../supabase'
export default function Categories(){
  const[cats,setCats]=useState([])
  const[adding,setAdding]=useState(false)
  const[newCat,setNewCat]=useState({name:'',type:'minor',icon:'🔧'})
  useEffect(()=>{fetch()},[])
  async function fetch(){const{data}=await supabase.from('categories').select('*').order('sort_order');setCats(data||[])}
  async function add(){if(!newCat.name)return;await supabase.from('categories').insert(newCat);setNewCat({name:'',type:'minor',icon:'🔧'});setAdding(false);fetch()}
  async function toggle(id,cur){await supabase.from('categories').update({is_active:!cur}).eq('id',id);fetch()}
  async function del(id){if(!confirm('Delete?'))return;await supabase.from('categories').delete().eq('id',id);fetch()}
  const major=cats.filter(c=>c.type==='major')
  const minor=cats.filter(c=>c.type==='minor')
  const Row=({cat,i,arr})=>(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none'}}>
      <span style={{fontSize:22}}>{cat.icon}</span>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{cat.name}</div></div>
      <span style={{background:cat.is_active?'var(--green-light)':'var(--red-light)',color:cat.is_active?'var(--green)':'var(--red)',fontSize:11,padding:'2px 8px',borderRadius:10}}>{cat.is_active?'Active':'Inactive'}</span>
      <button onClick={()=>toggle(cat.id,cat.is_active)} style={{padding:'4px 10px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,fontSize:12,cursor:'pointer'}}>{cat.is_active?'Disable':'Enable'}</button>
      <button onClick={()=>del(cat.id)} style={{padding:'4px 10px',background:'var(--red-light)',border:'none',borderRadius:6,fontSize:12,color:'var(--red)',cursor:'pointer'}}>Delete</button>
    </div>
  )
  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
      <div><h1 style={{fontSize:22,fontWeight:600}}>Categories</h1><p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>Manage service categories</p></div>
      <button onClick={()=>setAdding(true)} style={{padding:'8px 16px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'}}>+ Add Category</button>
    </div>
    {adding&&<div style={{background:'#fff',border:'1px solid var(--primary)',borderRadius:12,padding:20,marginBottom:20}}>
      <h3 style={{fontSize:14,fontWeight:600,marginBottom:14}}>New Category</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 80px',gap:12,marginBottom:12}}>
        <input value={newCat.name} onChange={e=>setNewCat({...newCat,name:e.target.value})} placeholder="Category name" style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:13,outline:'none'}}/>
        <select value={newCat.type} onChange={e=>setNewCat({...newCat,type:e.target.value})} style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:13,outline:'none',background:'#fff'}}>
          <option value="major">Major</option><option value="minor">Minor</option>
        </select>
        <input value={newCat.icon} onChange={e=>setNewCat({...newCat,icon:e.target.value})} placeholder="🔧" style={{padding:'8px',border:'1px solid var(--border)',borderRadius:6,fontSize:18,outline:'none',textAlign:'center'}}/>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={add} style={{padding:'8px 20px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:6,fontSize:13,cursor:'pointer'}}>Add</button>
        <button onClick={()=>setAdding(false)} style={{padding:'8px 20px',background:'var(--bg)',color:'var(--text2)',border:'1px solid var(--border)',borderRadius:6,fontSize:13,cursor:'pointer'}}>Cancel</button>
      </div>
    </div>}
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{background:'#e8f0fe',color:'var(--primary)',fontSize:11,padding:'3px 10px',borderRadius:10,fontWeight:600}}>MAJOR SERVICES</span>
        <span style={{fontSize:12,color:'var(--text3)'}}>Project-based, high value</span>
      </div>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
        {major.length===0?<p style={{padding:20,textAlign:'center',color:'var(--text3)',fontSize:13}}>No major categories</p>:major.map((cat,i)=><Row key={cat.id} cat={cat} i={i} arr={major}/>)}
      </div>
    </div>
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{background:'var(--green-light)',color:'var(--green)',fontSize:11,padding:'3px 10px',borderRadius:10,fontWeight:600}}>MINOR SERVICES</span>
        <span style={{fontSize:12,color:'var(--text3)'}}>Quick, local-based</span>
      </div>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
        {minor.length===0?<p style={{padding:20,textAlign:'center',color:'var(--text3)',fontSize:13}}>No minor categories</p>:minor.map((cat,i)=><Row key={cat.id} cat={cat} i={i} arr={minor}/>)}
      </div>
    </div>
  </div>)
}
