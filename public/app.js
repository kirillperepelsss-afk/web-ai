const form=document.querySelector('#askForm'),
input=document.querySelector('#question'),
button=document.querySelector('#askButton'),
counter=document.querySelector('#counter'),
result=document.querySelector('#result'),
answer=document.querySelector('#answer'),
sources=document.querySelector('#sources'),
voiceButton=document.querySelector('#voiceButton');

input.addEventListener('input',()=>counter.textContent=`${input.value.length} / 4000`);

document.querySelectorAll('.examples button').forEach(b=>b.onclick=()=>{
  input.value=b.textContent;
  input.dispatchEvent(new Event('input'));
  input.focus();
});

let recognition=null;
let isListening=false;
let baseText='';
let voiceText='';

if('SpeechRecognition' in window || 'webkitSpeechRecognition' in window){

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

  recognition=new SpeechRecognition();
  recognition.lang='ru-RU';
  recognition.continuous=true;
  recognition.interimResults=true;

  recognition.onstart=()=>{
    isListening=true;
    baseText=input.value.trim();
    voiceText='';

    voiceButton.textContent='🔴';
    voiceButton.style.background='rgba(255,60,60,.18)';
    voiceButton.style.borderColor='rgba(255,80,80,.6)';
    voiceButton.title='Остановить запись';
  };

  recognition.onresult=e=>{

    let newVoiceText='';

    for(let i=0;i<e.results.length;i++){
      newVoiceText+=e.results[i][0].transcript;
    }

    voiceText=newVoiceText.trim();

    let newValue=baseText;

    if(voiceText){
      newValue+=(baseText?' ':'')+voiceText;
    }

    if(newValue.length>4000){
      newValue=newValue.slice(0,4000);
    }

    input.value=newValue;
    input.dispatchEvent(new Event('input'));
  };

  recognition.onerror=e=>{
    console.error('Ошибка голосового ввода:',e.error);
    stopListening();
  };

  recognition.onend=()=>{
    if(isListening){
      stopListening();
    }
  };

}else{

  voiceButton.disabled=true;
  voiceButton.textContent='🎤';
  voiceButton.title='Голосовой ввод не поддерживается этим браузером';
  voiceButton.style.opacity='.5';
}

function stopListening(){

  isListening=false;

  if(recognition){
    try{
      recognition.stop();
    }catch(e){}
  }

  voiceButton.textContent='🎤';
  voiceButton.style.background='rgba(255,255,255,.06)';
  voiceButton.style.borderColor='rgba(255,255,255,.15)';
  voiceButton.title='Голосовой ввод';
}

voiceButton.onclick=()=>{

  if(!recognition){
    alert('Голосовой ввод не поддерживается этим браузером.');
    return;
  }

  if(isListening){
    stopListening();
    return;
  }

  baseText=input.value.trim();
  voiceText='';

  try{
    recognition.start();
  }catch(e){}
};

form.onsubmit=async e=>{

  e.preventDefault();

  const question=input.value.trim();

  if(!question)return;

  if(isListening){
    stopListening();
  }

  button.disabled=true;
  button.textContent='Ищу…';

  result.classList.remove('hidden');
  answer.textContent='Ищу актуальную информацию в интернете…';
  sources.innerHTML='';

  try{

    const r=await fetch('/api/ask',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({question})
    });

    const d=await r.json();

    if(!r.ok){
      throw Error(d.error||'Ошибка сервера');
    }

    answer.textContent=d.answer;

    if(d.sources?.length){
      sources.innerHTML=
        '<div class="sources-title">Источники</div>'+
        d.sources.map(s=>
          `<a class="source" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`
        ).join('');
    }

  }catch(err){

    answer.textContent=`Ошибка: ${err.message}`;

  }finally{

    button.disabled=false;
    button.textContent='Спросить ↗';

  }
};

function esc(v){

  return String(v).replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[c]));

}
