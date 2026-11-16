import {handleAction} from '../lib/intel.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try {
    const payload=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const data=await handleAction(payload,req.headers['x-tlw-access-code']);
    return res.status(200).json({ok:true,data});
  } catch(e) {
    return res.status(e.status||400).json({ok:false,error:e.message||'Request failed'});
  }
}
