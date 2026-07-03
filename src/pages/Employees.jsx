import{useState,useEffect}from'react'
import{supabase}from'../supabase'
export default function Employees(){
  const[emps,setEmps]=useState([])
  const[loading,setLoading]=useState(true)
  useEffect(()=>{fetch()},[])
  async function fetch(){setLoading(true);const{data}=await supabase.from('employees').select('*,companies(name)').order('created_at',{ascending:false});setEmps(data||[]);setLoading(false)}
  async function verify(id,cur){await supabase.from('employees').update({is_verified:!cur}).eq('id',id);fetch()}
  async function del(id){if(!confirm('Delete?'))return;await supabase.from('employees').delete().eq('id',id);fetch()}
  return(<div>
    <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:600}}>Employees</h1><p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>Manage employee profiles</p></div>
    {loading?<p style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Loading...</p>:
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflowX:'auto'}}>
      <table style={{width:'100%',minWidth:680,borderCollapse:'collapse'}}>
        <thead><tr style={{background:'var(--bg)'}}>
          {['Employee','Designation','Company','Rating','Status','Actions'].map(h=>(
            <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'var(--text2)',borderBottom:'1px solid var(--border)'}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {emps.map(emp=>(
            <tr key={emp.id} style={{borderBottom:'1px solid var(--border)'}}>
              <td style={{padding:'12px 16px'}}><div style={{fontSize:13,fontWeight:500}}>{emp.name}</div><div style={{fontSize:11,color:'var(--text3)'}}>{emp.phone}</div></td>
              <td style={{padding:'12px 16px',fontSize:13}}>{emp.designation}</td>
              <td style={{padding:'12px 16px',fontSize:13}}>{emp.companies?.name||'Independent'}</td>
              <td style={{padding:'12px 16px'}}><span style={{color:'var(--amber)',fontSize:13}}>★</span><span style={{fontSize:13,marginLeft:3}}>{emp.avg_rating||'0.0'}</span></td>
              <td style={{padding:'12px 16px'}}><span style={{background:emp.is_verified?'var(--green-light)':'var(--red-light)',color:emp.is_verified?'var(--green)':'var(--red)',fontSize:11,padding:'2px 8px',borderRadius:10}}>{emp.is_verified?'✓ Verified':'Unverified'}</span></td>
              <td style={{padding:'12px 16px'}}>
                <div style={{display:'flex',gap:6}}>
                  {emp.emirates_id_url&&<a href={emp.emirates_id_url} target="_blank" rel="noreferrer" style={{padding:'5px 10px',background:'#e8f0fe',color:'var(--primary)',borderRadius:6,fontSize:12,textDecoration:'none'}}>View ID</a>}
                  <button onClick={()=>verify(emp.id,emp.is_verified)} style={{padding:'5px 10px',background:emp.is_verified?'var(--amber-light)':'var(--green-light)',color:emp.is_verified?'var(--amber)':'var(--green)',border:'none',borderRadius:6,fontSize:12,cursor:'pointer'}}>{emp.is_verified?'Unverify':'Verify'}</button>
                  <button onClick={()=>del(emp.id)} style={{padding:'5px 10px',background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:6,fontSize:12,cursor:'pointer'}}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {emps.length===0&&<tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'var(--text3)',fontSize:13}}>No employees yet</td></tr>}
        </tbody>
      </table>
    </div>}
  </div>)
}
