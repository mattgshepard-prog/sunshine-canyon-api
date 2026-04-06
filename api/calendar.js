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
  const data=await resp.json();
  cachedToken=data.access_token;
  tokenExpiry=Date.now()+(data.expires_in*1000);
  return cachedToken;
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  try{
    const token=await getToken();
    const listingId=process.env.GUESTY_LISTING_ID||"693366e4e2c2460012d9ed96";
    const today=new Date();const end=new Date(today);
    end.setDate(end.getDate()+90);
    const startDate=today.toISOString().split("T")[0];
    const endDate=end.toISOString().split("T")[0];
    const calResp=await fetch(
      `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/${listingId}?startDate=${startDate}&endDate=${endDate}`,
      {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json"}}
    );
    const calData=await calResp.json();
    const days=calData?.data?.days||[];
    const calendar=days.map(d=>({
      date:d.date,price:d.price,status:d.status,
      minNights:d.minNights,available:d.status==="available",
    }));
    const available=calendar.filter(d=>d.available);
    const prices=available.map(d=>d.price).filter(Boolean);
    const summary={
      totalDays:calendar.length,availableDays:available.length,
      bookedDays:calendar.length-available.length,
      priceRange:prices.length?{min:Math.min(...prices),max:Math.max(...prices)}:null,
      avgPrice:prices.length?Math.round(prices.reduce((a,b)=>a+b,0)/prices.length):null,
      cleaningFee:135,currency:"USD",
    };
    res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({
      listing:{id:listingId,name:"Sunshine Canyon Retreat"},
      summary,calendar,
    });
  }catch(err){
    console.error("Guesty API error:",err);
    return res.status(500).json({error:"Failed to fetch calendar data"});
  }
}
