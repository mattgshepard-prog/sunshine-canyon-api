// api/quote.js — uses Open API (same inline auth as calendar.js)
let cachedToken=null;
let tokenExpiry=0;

async function getToken(){
  if(cachedToken&&Date.now()<tokenExpiry-60000)return cachedToken;
  const params=new URLSearchParams({
    grant_type:"client_credentials",scope:"open-api",
    client_id:process.env.GUESTY_CLIENT_ID,
    client_secret:process.env.GUESTY_CLIENT_SECRET,
  });
  const resp=await fetch("https://open-api.guesty.com/oauth2/token",{
    method:"POST",
    headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},
    body:params.toString(),
  });
  if(!resp.ok){
    const t=await resp.text().catch(()=>'');
    console.error('token err',resp.status,t);
    throw new Error('token '+resp.status);
  }
  const data=await resp.json();
  cachedToken=data.access_token;
  tokenExpiry=Date.now()+(data.expires_in*1000);
  return cachedToken;
}

const FALLBACK_URL='https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const LISTING_ID='693366e4e2c2460012d9ed96';
const ALLOWED_ORIGINS=['https://mattgshepard-prog.github.io','http://localhost:3000','http://localhost:8080'];

function setCors(req,res){
  const origin=req.headers.origin||'';
  const allowed=ALLOWED_ORIGINS.find(o=>origin.startsWith(o));
  res.setHeader('Access-Control-Allow-Origin',allowed||'*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

export default async function handler(req,res){
  setCors(req,res);
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed',fallbackUrl:FALLBACK_URL});

  const{checkIn,checkOut,guests}=req.body||{};
  if(!checkIn||!checkOut)return res.status(400).json({error:'checkIn and checkOut are required',fallbackUrl:FALLBACK_URL});
  const inD=new Date(checkIn),outD=new Date(checkOut);
  if(isNaN(inD)||isNaN(outD))return res.status(400).json({error:'Invalid dates',fallbackUrl:FALLBACK_URL});
  if(outD<=inD)return res.status(400).json({error:'checkOut must be after checkIn',fallbackUrl:FALLBACK_URL});
  const gc=parseInt(guests,10);
  if(!guests||isNaN(gc)||gc<1)return res.status(400).json({error:'guests must be positive integer',fallbackUrl:FALLBACK_URL});

  const listingId=process.env.GUESTY_LISTING_ID||LISTING_ID;
  try{
    const token=await getToken();
    const qResp=await fetch('https://open-api.guesty.com/v1/quotes',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Accept':'application/json','Content-Type':'application/json'},
      body:JSON.stringify({
        listingId,
        checkInDateLocalized:checkIn,
        checkOutDateLocalized:checkOut,
        guestsCount:gc,
        source:'OAPI',
        ignoreTerms:false,ignoreCalendar:false,ignoreBlocks:false,
      }),
    });
    if(!qResp.ok){
      const errBody=await qResp.text().catch(()=>'');
      console.error('Guesty quote error:',qResp.status,errBody);
      if(qResp.status===400||qResp.status===422)return res.status(400).json({error:'These dates are not available',fallbackUrl:FALLBACK_URL});
      return res.status(500).json({error:'Failed to create quote',fallbackUrl:FALLBACK_URL});
    }
    const data=await qResp.json();
    const ratePlans=(data.rates&&data.rates.ratePlans||[]).map(function(rp){
      const days=rp.days||[];
      const nt=days.reduce(function(s,d){return s+(d.price||0)},0);
      const fees=rp.fees||[];
      const taxes=rp.taxes||[];
      const ft=fees.reduce(function(s,f){return s+(f.amount||0)},0);
      const tt=taxes.reduce(function(s,t){return s+(t.amount||0)},0);
      return{
        ratePlanId:(rp.ratePlan&&rp.ratePlan.id)||rp.id||null,
        name:(rp.ratePlan&&rp.ratePlan.name)||'Standard',
        days:days.map(function(d){return{date:d.date,price:d.price,currency:d.currency||'USD'}}),
        fees:fees,taxes:taxes,
        totals:{nights:nt,fees:ft,taxes:tt,total:nt+ft+tt},
      };
    });
    return res.status(200).json({quoteId:data._id,expiresAt:data.expiresAt,ratePlans:ratePlans});
  }catch(err){
    console.error('Quote error:',err);
    return res.status(500).json({error:'Failed to create quote',fallbackUrl:FALLBACK_URL});
  }
}
