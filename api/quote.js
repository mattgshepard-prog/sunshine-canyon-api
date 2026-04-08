// api/quote.js — DEBUG version to see full token error
let cachedToken=null;
let tokenExpiry=0;

async function getToken(){
  if(cachedToken&&Date.now()<tokenExpiry-60000)return cachedToken;
  const params=new URLSearchParams({
    grant_type:"client_credentials",scope:"open-api",
    client_id:process.env.GUESTY_CLIENT_ID,
    client_secret:process.env.GUESTY_CLIENT_SECRET,
  });
  console.log('TOKEN_REQ client_id_len:', (process.env.GUESTY_CLIENT_ID||'').length);
  console.log('TOKEN_REQ secret_len:', (process.env.GUESTY_CLIENT_SECRET||'').length);
  const resp=await fetch("https://open-api.guesty.com/oauth2/token",{
    method:"POST",
    headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},
    body:params.toString(),
  });
  console.log('TOKEN_RESP status:', resp.status);
  if(!resp.ok){
    const t=await resp.text().catch(()=>'');
    console.error('TOKEN_BODY_1:', t.substring(0,200));
    console.error('TOKEN_BODY_2:', t.substring(200,400));
    throw new Error('token '+resp.status);
  }
  const data=await resp.json();
  cachedToken=data.access_token;
  tokenExpiry=Date.now()+(data.expires_in*1000);
  return cachedToken;
}

const FALLBACK='https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';

function setCors(req,res){
  const o=req.headers.origin||'';
  const a=['https://mattgshepard-prog.github.io','http://localhost:3000'].find(x=>o.startsWith(x));
  res.setHeader('Access-Control-Allow-Origin',a||'*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

export default async function handler(req,res){
  setCors(req,res);
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const{checkIn,checkOut,guests}=req.body||{};
  if(!checkIn||!checkOut)return res.status(400).json({error:'checkIn/checkOut required'});
  try{
    const token=await getToken();
    console.log('TOKEN_OK len:', token.length);
    const listingId=process.env.GUESTY_LISTING_ID||'693366e4e2c2460012d9ed96';
    const qResp=await fetch('https://open-api.guesty.com/v1/quotes',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Accept':'application/json','Content-Type':'application/json'},
      body:JSON.stringify({listingId,checkInDateLocalized:checkIn,checkOutDateLocalized:checkOut,guestsCount:parseInt(guests)||2,source:'OAPI',ignoreTerms:false,ignoreCalendar:false,ignoreBlocks:false}),
    });
    console.log('QUOTE_RESP status:', qResp.status);
    if(!qResp.ok){
      const e=await qResp.text().catch(()=>'');
      console.error('QUOTE_ERR_1:', e.substring(0,200));
      console.error('QUOTE_ERR_2:', e.substring(200,400));
      return res.status(qResp.status).json({error:'Quote failed: '+qResp.status,detail:e.substring(0,300),fallbackUrl:FALLBACK});
    }
    const data=await qResp.json();
    return res.status(200).json({quoteId:data._id,expiresAt:data.expiresAt,ratePlans:data.rates&&data.rates.ratePlans||[],raw:data});
  }catch(err){
    console.error('CATCH:',err.message);
    return res.status(500).json({error:err.message,fallbackUrl:FALLBACK});
  }
}
