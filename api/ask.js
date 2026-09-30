import OpenAI from "openai";
export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
 try{
  const question=String(req.body?.question||"").trim();
  if(!question)return res.status(400).json({error:"Введите вопрос."});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"OPENAI_API_KEY не настроен."});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const response=await client.responses.create({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",tools:[{type:"web_search"}],input:[{role:"system",content:"Ты WebAI — веб-исследователь. Используй веб-поиск для актуальной информации. Отвечай на русском языке, ясно и по существу. Не выдумывай факты."},{role:"user",content:question}]});
  const sources=[];
  for(const item of response.output||[]) if(item.type==="message") for(const part of item.content||[]) for(const ann of part.annotations||[]) if(ann.type==="url_citation"&&ann.url)sources.push({title:ann.title||ann.url,url:ann.url});
  return res.status(200).json({answer:response.output_text||"Не удалось получить ответ.",sources:[...new Map(sources.map(s=>[s.url,s])).values()].slice(0,8)});
 }catch(e){console.error(e);return res.status(500).json({error:"Не удалось обработать запрос."});}
}
