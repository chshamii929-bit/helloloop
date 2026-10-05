import geoip from 'geoip-lite';
import { isIP } from 'node:net';
export function detectCountry(req) {
  const address=req.socket.remoteAddress?.replace(/^::ffff:/,'')||'';
  const tunnel=process.env.TRUST_CLOUDFLARE_PROXY==='true' && ['127.0.0.1','::1'].includes(address);
  if(tunnel){
    const code=req.headers['cf-ipcountry'];
    if(typeof code==='string' && /^[A-Z]{2}$/.test(code) && !['XX','T1'].includes(code))return code;
  }
  const ip=tunnel?req.headers['cf-connecting-ip']:address;
  if(typeof ip!=='string'||!isIP(ip))return null;
  try{return geoip.lookup(ip)?.country||null;}catch{return null;}
}
