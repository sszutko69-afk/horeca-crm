'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type MascotState = 'sleeping' | 'waking' | 'greeting' | 'idle' | 'speaking' | 'alert'
type PanelView   = 'main' | 'help'
type Season = 'christmas'|'newyear'|'valentine'|'easter'|'spring'|'summer'|'autumn'|'halloween'|'winter'|'normal'

interface ContextItem { type:'alert'|'warning'|'info'; text:string; href:string; icon:string; detail?:string; rekordId?:string; rekordTyp?:string; data?:string }
interface ContextData { userName:string; items:ContextItem[] }
interface Pos { x:number; y:number }

// ─── Kolory małpki ────────────────────────────────────────────────────────────
const C = {
  fur:    '#1C0E06',   // ciemna czekolada
  face:   '#C8743A',   // ciepły tan (twarz / inner ear)
  muzzle: '#D4855A',   // jaśniejszy pysk
  belly:  '#A85A28',   // brzuszek
  dark:   '#0D0700',   // oczy/nos
  blush:  'rgba(210,80,50,0.28)',
}

// ─── Season detection ─────────────────────────────────────────────────────────
function detectSeason(): { season:Season; emoji:string; greeting:string } {
  const now=new Date(); const m=now.getMonth()+1; const d=now.getDate()
  if(m===12&&d>=1&&d<=26)                    return{season:'christmas',emoji:'🎅',greeting:'Wesołych Świąt Bożego Narodzenia! 🎄'}
  if((m===12&&d>=27)||(m===1&&d<=5))         return{season:'newyear',  emoji:'🎉',greeting:'Szczęśliwego Nowego Roku! 🥳'}
  if(m===2&&d>=11&&d<=15)                    return{season:'valentine', emoji:'💘',greeting:'Szczęśliwych Walentynek! ❤️'}
  if((m===3&&d>=20)||(m===4&&d<=25))         return{season:'easter',   emoji:'🐣',greeting:'Wesołego Alleluja! 🐰'}
  if(m>=3&&m<=5)                             return{season:'spring',   emoji:'🌸',greeting:'Pięknej wiosny i słonecznej pogody! 🌼'}
  if((m>=6&&m<=8)||(m===9&&d<=15))           return{season:'summer',   emoji:'☀️',greeting:'Udanych wakacji i słonecznych dni! 🏄'}
  if(m===10&&d>=25)                          return{season:'halloween', emoji:'🎃',greeting:'Happy Halloween! 🧙'}
  if((m===9&&d>=16)||m===10||(m===11&&d<=14))return{season:'autumn',   emoji:'🍂',greeting:'Kolorowej złotej jesieni! 🍁'}
  if((m===11&&d>=15)||(m===1&&d>=6&&d<=14)) return{season:'winter',   emoji:'❄️',greeting:'Ciepłej i przytulnej zimy! ⛄'}
  return{season:'normal',emoji:'🐒',greeting:''}
}

// ─── Keyframe injection ───────────────────────────────────────────────────────
function injectKeyframes(){
  if(typeof document==='undefined'||document.getElementById('ml-kf')) return
  const s=document.createElement('style'); s.id='ml-kf'
  s.textContent=`
    @keyframes ml-sleep  { 0%,100%{transform:rotate(-3deg) translateY(0)} 50%{transform:rotate(3deg) translateY(4px)} }
    @keyframes ml-wake   { 0%{transform:scale(.7) rotate(-8deg)} 60%{transform:scale(1.06) rotate(3deg)} 100%{transform:scale(1) rotate(0)} }
    @keyframes ml-bob    { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-6px) rotate(1deg)} }
    @keyframes ml-shake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px) rotate(-4deg)} 75%{transform:translateX(5px) rotate(4deg)} }
    @keyframes ml-alert  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.13) rotate(-4deg)} }
    @keyframes ml-wave   { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(-30deg)} 70%{transform:rotate(20deg)} }
    @keyframes ml-zzz    { 0%{opacity:0;transform:translateY(0) scale(.7)} 30%{opacity:1} 80%{opacity:.8} 100%{opacity:0;transform:translateY(-28px) scale(1.1)} }
    @keyframes ml-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes ml-blink  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.07)} }
  `
  document.head.appendChild(s)
}

// ─── Seasonal ground (identical environments as Gazek) ────────────────────────
function SeasonalGroundBack({ season }: { season:Season }) {
  switch(season) {
    case 'spring': return (
      <g>
        <rect x="-10" y="238" width="220" height="24" fill="#558B2F"/>
        <path d="M-10 238 C2 229 14 236 26 229 C38 222 50 232 62 226 C74 220 86 230 100 224 C114 218 126 228 138 222 C150 216 162 226 174 220 C186 214 200 224 210 218 L210 238Z" fill="#7CB342"/>
        {[15,45,80,115,150,182].map(x=>(
          <g key={x}>
            <circle cx={x+3} cy={230} r="4.5" fill="#FFEB3B"/>
            {[0,72,144,216,288].map(a=>{const r=a*Math.PI/180;return<ellipse key={a} cx={x+3+5*Math.cos(r)} cy={230+5*Math.sin(r)} rx="3" ry="4.5" fill="white" transform={`rotate(${a} ${x+3+5*Math.cos(r)} ${230+5*Math.sin(r)})`} opacity=".9"/>})}
          </g>
        ))}
      </g>
    )
    case 'summer': return (
      <g>
        <rect x="-10" y="238" width="220" height="24" fill="#F9A825"/>
        <path d="M-10 238 Q10 232 30 238 Q50 244 70 238 Q90 232 110 238 Q130 244 150 238 Q170 232 190 238 Q205 244 210 238 L210 244Z" fill="#FDD835"/>
        <path d="M-10 234 Q10 228 30 234 Q50 240 70 234 Q90 228 110 234 Q130 240 150 234 Q170 228 190 234 Q205 240 210 234 L210 238 L-10 238Z" fill="#FFE082"/>
        <path d="M150 218 Q165 208 175 218 Q185 228 175 232 Q165 236 150 218Z" fill="#0288D1" opacity=".5"/>
        <path d="M30 222 Q45 215 52 224 Q59 233 45 236 Q30 238 30 222Z" fill="#0288D1" opacity=".35"/>
      </g>
    )
    case 'autumn': return (
      <g>
        <rect x="-10" y="238" width="220" height="24" fill="#5D4037"/>
        {[
          {x:15,y:236,c:'#FF8F00'},{x:35,y:233,c:'#E65100'},{x:58,y:237,c:'#FF6F00'},
          {x:80,y:234,c:'#FF8F00'},{x:102,y:236,c:'#BF360C'},{x:125,y:233,c:'#FF8F00'},
          {x:148,y:237,c:'#E65100'},{x:168,y:234,c:'#FF6F00'},{x:190,y:236,c:'#FF8F00'},
        ].map((l,i)=>(
          <path key={i} d={`M${l.x} ${l.y} C${l.x+5} ${l.y-8} ${l.x+12} ${l.y-5} ${l.x+10} ${l.y+4} C${l.x+8} ${l.y+10} ${l.x} ${l.y+8} ${l.x} ${l.y}Z`}
            fill={l.c} transform={`rotate(${i*40} ${l.x+5} ${l.y})`}/>
        ))}
      </g>
    )
    case 'winter': return (
      <g>
        <rect x="-10" y="238" width="220" height="24" fill="#E3F2FD"/>
        <path d="M-10 238 Q4 228 18 234 Q32 220 46 228 Q60 215 74 224 Q88 212 102 222 Q116 212 130 220 Q144 210 158 218 Q172 208 186 216 Q200 208 210 216 L210 238Z" fill="white"/>
        {[48,155].map(cx=>(
          <g key={cx}>
            <ellipse cx={cx} cy={230} rx="18" ry="10" fill="white"/>
            <ellipse cx={cx} cy={230} rx="13" ry="7" fill="#E3F2FD"/>
            <circle cx={cx-5} cy={226} r="3" fill="white"/>
            <circle cx={cx+5} cy={225} r="2.5" fill="white"/>
          </g>
        ))}
      </g>
    )
    default: return null
  }
}

function SeasonalGroundFront({ season }: { season:Season }) {
  switch(season) {
    case 'spring': return (
      <g>
        {[22,55,88,120,152,178].map(x=>(
          <path key={x} d={`M${x} 240 C${x-2} 233 ${x+2} 232 ${x} 240`} fill="#8BC34A" opacity=".75"/>
        ))}
      </g>
    )
    case 'summer': return (
      <g>
        {[20,45,70,95,120,145,170,195].map((x,i)=>(
          <circle key={x} cx={x} cy={240+(i%2)} r={1+i%2} fill="#FFF9C4" opacity=".7"/>
        ))}
      </g>
    )
    case 'autumn': return (
      <g>
        <path d="M30 242 C36 238 40 240 36 245Z" fill="#FF8F00"/>
        <path d="M100 240 C106 235 112 238 108 244Z" fill="#E65100"/>
        <path d="M165 242 C170 237 175 240 171 245Z" fill="#FF6F00"/>
      </g>
    )
    case 'winter': return (
      <g>
        {[30,70,110,150,185].map((x,i)=>(
          <circle key={x} cx={x} cy={240} r={1.5-(i%2)*0.5} fill="white" opacity=".8"/>
        ))}
      </g>
    )
    default: return null
  }
}

// ─── Sezonowe akcesoria PRZED małpką ────────────────────────────────────────
function SeasonalFrontMonkey({ season }: { season:Season }) {
  switch(season) {
    // ── Mikołaj ──────────────────────────────────────────────────────────────
    case 'christmas': return (
      <g>
        <ellipse cx="100" cy="70" rx="48" ry="10" fill="white"/>
        <path d="M56 70 C60 48 72 28 86 15 C90 9 96 6 100 6 C104 6 110 9 114 15 C128 28 140 48 144 70Z" fill="#C62828"/>
        <path d="M100 6 C104 6 110 9 113 15 C126 28 138 49 143 70 L130 70 C124 51 115 32 107 18 C104 12 102 8 100 6Z" fill="rgba(0,0,0,0.12)"/>
        <ellipse cx="100" cy="70" rx="48" ry="9" fill="white"/>
        <circle cx="101" cy="6" r="9" fill="white"/>
      </g>
    )
    // ── Sylwester ─────────────────────────────────────────────────────────────
    case 'newyear': return (
      <g>
        <ellipse cx="100" cy="62" rx="36" ry="9" fill="#6A1B9A"/>
        <path d="M68 62 C72 44 84 26 94 14 C97 8 99 6 100 6 C101 6 103 8 106 14 C116 26 128 44 132 62Z" fill="#9C27B0"/>
        <ellipse cx="100" cy="62" rx="36" ry="8" fill="#4A148C"/>
        <circle cx="100" cy="6" r="7" fill="#FFEB3B"/>
        {[{x:152,y:52,c:'#FF5252'},{x:32,y:58,c:'#40C4FF'},{x:160,y:80,c:'#FFEB3B'},{x:28,y:85,c:'#69F0AE'}].map((r,i)=>(
          <rect key={i} x={r.x} y={r.y} width="8" height="4" rx="1" fill={r.c}
            style={{animation:`ml-zzz 2.2s ${i*.4}s ease-in-out infinite`}} opacity="0"/>
        ))}
      </g>
    )
    // ── Walentynki ────────────────────────────────────────────────────────────
    case 'valentine': return (
      <g>
        <path d="M100 48 C100 48 88 36 81 43 C74 50 80 60 100 75 C120 60 126 50 119 43 C112 36 100 48 100 48Z" fill="#E91E63" opacity=".9" style={{animation:'ml-float 1.8s ease-in-out infinite'}}/>
        <ellipse cx="68" cy="130" rx="15" ry="9" fill="#FF80AB" opacity=".35"/>
        <ellipse cx="132" cy="130" rx="15" ry="9" fill="#FF80AB" opacity=".35"/>
      </g>
    )
    // ── Wielkanoc: pisanka ────────────────────────────────────────────────────
    case 'easter': return (
      <g>
        <ellipse cx="158" cy="205" rx="12" ry="16" fill="#E91E63"/>
        <path d="M146 205 Q158 194 170 205" stroke="#FFEB3B" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M146 205 Q158 216 170 205" stroke="#4CAF50" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <circle cx="153" cy="197" r="2.5" fill="#FFEB3B"/>
        <circle cx="162" cy="213" r="2.5" fill="#4CAF50"/>
      </g>
    )
    // ── Lato: słomkowy kapelusz + okulary ─────────────────────────────────────
    case 'summer': return (
      <g>
        <ellipse cx="100" cy="68" rx="56" ry="10" fill="#8D6E63"/>
        <path d="M54 68 C56 46 68 36 100 34 C132 36 144 46 146 68Z" fill="#A1887F"/>
        <path d="M56 68 C58 48 70 38 100 36 C130 38 142 48 144 68Z" fill="#BCAAA4"/>
        <path d="M62 63 Q100 59 138 63" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <ellipse cx="82"  cy="118" rx="14" ry="11" fill="rgba(2,62,138,.8)"/>
        <ellipse cx="118" cy="118" rx="14" ry="11" fill="rgba(2,62,138,.8)"/>
        <ellipse cx="79"  cy="115" rx="4"  ry="3"  fill="rgba(255,255,255,.28)"/>
        <ellipse cx="115" cy="115" rx="4"  ry="3"  fill="rgba(255,255,255,.28)"/>
        <ellipse cx="82"  cy="118" rx="14" ry="11" fill="none" stroke="#111" strokeWidth="1.8"/>
        <ellipse cx="118" cy="118" rx="14" ry="11" fill="none" stroke="#111" strokeWidth="1.8"/>
        <path d="M96 118 Q100 115 104 118" stroke="#111" strokeWidth="1.8" fill="none"/>
        <path d="M68 118 Q59 116 53 120" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M132 118 Q141 116 147 120" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </g>
    )
    // ── Jesień: szalik ─────────────────────────────────────────────────────────
    case 'autumn': return (
      <g>
        <path d="M56 192 Q100 182 144 192 L144 200 Q100 192 56 200Z" fill="#D84315"/>
        <path d="M56 200 Q100 192 144 200 L144 207 Q100 200 56 207Z" fill="#FF7043"/>
        <rect x="57" y="207" width="18" height="26" rx="7" fill="#D84315"/>
        <path d="M62 210 L70 210 L70 233 Q64 238 62 233Z" fill="#FF8A65"/>
        <path d="M158 60 C163 52 173 54 172 64 C171 72 160 74 156 67Z" fill="#FF8F00" style={{animation:'ml-float 2.5s ease-in-out infinite',transformBox:'fill-box',transformOrigin:'center'}}/>
      </g>
    )
    // ── Halloween: rogiki ──────────────────────────────────────────────────────
    case 'halloween': return (
      <g>
        <path d="M70 72 C64 56 60 38 68 26 C72 18 78 20 76 32 C80 22 86 14 88 26 C84 38 84 52 80 66Z" fill="#212121"/>
        <path d="M130 72 C136 56 140 38 132 26 C128 18 122 20 124 32 C120 22 114 14 112 26 C116 38 116 52 120 66Z" fill="#212121"/>
        <path d="M72 68 C70 58 68 46 72 36 L76 50 L80 36 C82 50 76 62 74 70Z" fill="#FF6D00"/>
        <path d="M128 68 C130 58 132 46 128 36 L124 50 L120 36 C118 50 124 62 126 70Z" fill="#FF6D00"/>
      </g>
    )
    // ── Zima: czapka beanie ────────────────────────────────────────────────────
    case 'winter': return (
      <g>
        <ellipse cx="100" cy="76" rx="48" ry="11" fill="#1565C0"/>
        <path d="M55 76 C57 50 68 36 100 32 C132 36 143 50 145 76Z" fill="#1976D2"/>
        <path d="M55 76 L145 76 L145 83 L55 83Z" fill="#1565C0"/>
        <path d="M55 76 L145 76 L145 88 Q100 92 55 88Z" fill="#0D47A1"/>
        <ellipse cx="100" cy="32" rx="10" ry="10" fill="#90CAF9"/>
        {[0,72,144,216,288].map(a=>{const r=a*Math.PI/180;return<circle key={a} cx={100+8*Math.cos(r)} cy={32+8*Math.sin(r)} r="3" fill="#90CAF9" opacity=".7"/>})}
      </g>
    )
    // ── Wiosna: wieniec kwiatowy ───────────────────────────────────────────────
    case 'spring': return (
      <g>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>{
          const r=a*Math.PI/180; const px=100+32*Math.cos(r); const py=82+18*Math.sin(r)
          const c=['#EC407A','#FF7043','#FFEB3B','#66BB6A','#42A5F5'][Math.floor(a/72)%5]
          return <circle key={a} cx={px} cy={py} r="5.5" fill={c} opacity=".9"/>
        })}
        <ellipse cx="100" cy="82" rx="22" ry="12" fill="none" stroke="#66BB6A" strokeWidth="1.5"/>
        <circle cx="100" cy="82" r="5" fill="#FFEB3B"/>
      </g>
    )
    default: return null
  }
}

// ─── Akcesoria PRZED głową: uszy wielkanocne (za ciałem) ─────────────────────
function SeasonalBehindMonkey({ season }: { season:Season }) {
  if(season==='easter') return (
    <g>
      <ellipse cx="76"  cy="50" rx="10" ry="26" fill="white"/>
      <ellipse cx="76"  cy="50" rx="5.5" ry="18" fill="#FFCDD2"/>
      <ellipse cx="124" cy="50" rx="10" ry="26" fill="white"/>
      <ellipse cx="124" cy="50" rx="5.5" ry="18" fill="#FFCDD2"/>
    </g>
  )
  return null
}

// ─── Tips dla małpki ──────────────────────────────────────────────────────────
const TIPS = [
  'Hej, mam do Ciebie list! 📮',
  'Sprawdziłam terminarz — wszystko ok! ✅',
  'Potrzebujesz czegoś? Kliknij mnie! 🐒',
  'Masz nowe zadania? Sprawdź CRM! 📋',
  'Jestem Mala — zawsze do Twojej dyspozycji! 🐵',
  'Pamiętaj o terminach przetargów! ⏰',
  'Czy zapisałeś dzisiaj czas pracy? 📝',
  'Dobre wieści: wszystko idzie zgodnie z planem! 🎉',
  'Mogę znaleźć przetargi dla Ciebie! 🔍',
  'Oo oo! Mam dla Ciebie ważną informację! 📬',
]

// ─── Główny komponent ─────────────────────────────────────────────────────────
export default function MalaAssistant() {
  injectKeyframes()

  const supabase   = useRef(createClient())
  const mountedRef = useRef(true)
  const posRef     = useRef<Pos|null>(null)
  const dragRef    = useRef({active:false,startMX:0,startMY:0,startPX:0,startPY:0,moved:false})
  const bubbleTRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const tipIdxRef  = useRef(0)

  const [pos,        setPos]        = useState<Pos|null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [minimized,  setMinimized]  = useState(false)
  const [state,      setState]      = useState<MascotState>('sleeping')
  const [showBubble, setShowBubble] = useState(false)
  const [bubbleText, setBubbleText] = useState('')
  const [panelOpen,  setPanelOpen]  = useState(false)
  const [panelView,  setPanelView]  = useState<PanelView>('main')
  const [eyesClosed, setEyesClosed] = useState(false)
  const [mouthOpen,  setMouthOpen]  = useState(false)
  const [context,    setContext]    = useState<ContextData>({userName:'',items:[]})
  const [ctxLoaded,  setCtxLoaded]  = useState(false)
  // Podgląd przetargu + akcje
  const [preview,    setPreview]    = useState<ContextItem|null>(null)
  const [actionMsg,  setActionMsg]  = useState('')

  const seasonal = detectSeason()

  // Odczyt odłożonych ("przypomnij później") przetargów z localStorage
  function getSnoozed(): Record<string,number> {
    if(typeof window==='undefined') return {}
    try { return JSON.parse(localStorage.getItem('mala-snooze')||'{}') } catch { return {} }
  }
  function snoozeItem(id:string, hours=4){
    const s=getSnoozed(); s[id]=Date.now()+hours*3600000
    localStorage.setItem('mala-snooze',JSON.stringify(s))
  }

  function defaultPos(): Pos {
    if(typeof window==='undefined') return{x:60,y:600}
    return{x:window.innerWidth-180,y:window.innerHeight-210}
  }

  function updatePos(p:Pos){posRef.current=p;setPos(p)}

  useEffect(()=>{
    mountedRef.current=true
    const saved=typeof window!=='undefined'&&localStorage.getItem('mala-pos')
    if(saved){try{const p=JSON.parse(saved);posRef.current=p;setPos(p)}catch{}}
    if(!pos){updatePos(defaultPos())}
    return()=>{mountedRef.current=false}
  },[])

  // ─── Mouse/touch drag ────────────────────────────────────────────────────────
  useEffect(()=>{
    function onMove(e:MouseEvent|TouchEvent){
      if(!dragRef.current.active) return
      const cx='touches' in e?e.touches[0].clientX:(e as MouseEvent).clientX
      const cy='touches' in e?e.touches[0].clientY:(e as MouseEvent).clientY
      const dx=cx-dragRef.current.startMX; const dy=cy-dragRef.current.startMY
      if(Math.abs(dx)+Math.abs(dy)>4) dragRef.current.moved=true
      if(!dragRef.current.moved) return
      const np={x:Math.max(0,Math.min(window.innerWidth-100,dragRef.current.startPX+dx)),y:Math.max(0,Math.min(window.innerHeight-160,dragRef.current.startPY+dy))}
      updatePos(np)
    }
    function onUp(){
      if(!dragRef.current.active) return
      dragRef.current.active=false; setIsDragging(false)
      if(posRef.current) localStorage.setItem('mala-pos',JSON.stringify(posRef.current))
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
    window.addEventListener('touchmove',onMove,{passive:false}); window.addEventListener('touchend',onUp)
    return()=>{
      window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp)
      window.removeEventListener('touchmove',onMove); window.removeEventListener('touchend',onUp)
    }
  },[])

  // ─── Wake sequence ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const t1=setTimeout(()=>{
      if(!mountedRef.current) return
      setState('waking')
      const t2=setTimeout(async()=>{
        if(!mountedRef.current) return
        setState('greeting')
        await fetchContext()
        const t3=setTimeout(()=>{
          if(!mountedRef.current) return
          setState('idle')
          if(seasonal.greeting) setTimeout(()=>{ if(mountedRef.current) showMsg(seasonal.greeting,'speaking') },1500)
        },3500)
        return()=>clearTimeout(t3)
      },1600)
      return()=>clearTimeout(t2)
    },1800)
    return()=>clearTimeout(t1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // ─── Context fetch after wake ─────────────────────────────────────────────────
  useEffect(()=>{
    if(state!=='idle'||ctxLoaded) return
    fetchContext()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state])

  // ─── Greeting → show context message ─────────────────────────────────────────
  useEffect(()=>{
    if(state!=='greeting') return
    const t=setTimeout(()=>{
      if(!mountedRef.current||!ctxLoaded) return
      const alertItem=context.items.find(i=>i.type==='alert')
      if(alertItem){
        setTimeout(()=>{ if(mountedRef.current) showMsg(`${alertItem.icon} ${alertItem.text}`,'alert') },4000)
      } else if(context.userName){
        setTimeout(()=>{ if(mountedRef.current) showMsg(`Cześć ${context.userName}! Mam dla Ciebie list! 📬`,'speaking') },4000)
      }
    },2000)
    return()=>clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state])

  // ─── Blinking ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!['idle','speaking','greeting'].includes(state)) return
    const schedule=():ReturnType<typeof setTimeout>=>setTimeout(()=>{
      if(!mountedRef.current) return
      setEyesClosed(true); setTimeout(()=>{ if(mountedRef.current) setEyesClosed(false) },130)
      blinkT=schedule()
    },2500+Math.random()*3500)
    let blinkT=schedule(); return()=>clearTimeout(blinkT)
  },[state])

  // ─── Speaking mouth ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(state!=='speaking'&&state!=='alert') return
    const iv=setInterval(()=>setMouthOpen(v=>!v),220)
    return()=>{clearInterval(iv); setMouthOpen(false)}
  },[state])

  // ─── Periodic tips ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(state!=='idle') return
    const iv=setInterval(()=>{
      if(!mountedRef.current||panelOpen) return
      const alertItems=context.items.filter(i=>i.type==='alert')
      const msg=alertItems.length>0&&tipIdxRef.current%3===0?alertItems[0].text:TIPS[tipIdxRef.current%TIPS.length]
      tipIdxRef.current++
      showMsg(msg,alertItems.length>0&&tipIdxRef.current%3===1?'alert':'speaking')
    },50000)
    return()=>clearInterval(iv)
  },[state,context.items,panelOpen])

  async function fetchContext(){
    try{
      const{data:{session}}=await supabase.current.auth.getSession()
      if(!session) return
      const res=await fetch('/api/gazek-context',{headers:{Authorization:`Bearer ${session.access_token}`}})
      if(!res.ok) return
      const data:ContextData=await res.json()
      // Odfiltruj odłożone ("przypomnij później") przetargi
      const snoozed=getSnoozed(); const now=Date.now()
      data.items=(data.items||[]).filter(i=>!(i.rekordId&&snoozed[i.rekordId]&&snoozed[i.rekordId]>now))
      if(mountedRef.current){setContext(data);setCtxLoaded(true)}
    }catch{}
  }

  // ─── Akcje na przetargu z podglądu ─────────────────────────────────────────
  function flashAction(msg:string){ setActionMsg(msg); setTimeout(()=>{ if(mountedRef.current) setActionMsg('') },2500) }

  async function przetargAkcja(item:ContextItem, akcja:'usun'|'odrzuc'|'obserwuj'|'przypomnij'){
    const id=item.rekordId; if(!id) return
    const sb=supabase.current
    if(akcja==='usun'){
      await sb.from('przetargi').update({usuniete:true,usuniete_at:new Date().toISOString()}).eq('id',id)
      flashAction('🗑 Przetarg usunięty')
    } else if(akcja==='odrzuc'){
      await sb.from('przetargi').update({status:'pominiety'}).eq('id',id)
      flashAction('⏭ Przetarg odrzucony')
    } else if(akcja==='obserwuj'){
      await sb.from('przetargi').update({obserwowany:true,status:'obserwowany'}).eq('id',id)
      flashAction('★ Dodano do obserwowanych')
    } else if(akcja==='przypomnij'){
      snoozeItem(id,4)
      flashAction('🔔 Przypomnę za 4 godziny')
    }
    // Usuń pozycję z listy i zamknij podgląd
    setContext(c=>({...c,items:c.items.filter(i=>i.rekordId!==id)}))
    setPreview(null)
  }

  const showMsg=useCallback((text:string,nextState:MascotState='speaking')=>{
    if(bubbleTRef.current) clearTimeout(bubbleTRef.current)
    setPanelOpen(false); setState(nextState); setBubbleText(text); setShowBubble(true)
    bubbleTRef.current=setTimeout(()=>{ if(mountedRef.current){setShowBubble(false);setState('idle')} },Math.max(5000,text.length*65))
  },[])

  function dismissBubble(){ if(bubbleTRef.current) clearTimeout(bubbleTRef.current); setShowBubble(false); if(state==='speaking'||state==='alert') setState('idle') }

  // Odśwież kontekst gdy otwierany panel
  useEffect(()=>{ if(panelOpen) fetchContext() },[panelOpen])

  function startDrag(e:React.MouseEvent|React.TouchEvent){
    if('button' in e&&e.button!==0) return
    e.stopPropagation()
    const cx='touches' in e?e.touches[0].clientX:e.clientX; const cy='touches' in e?e.touches[0].clientY:e.clientY
    const cur=posRef.current??defaultPos()
    dragRef.current={active:true,startMX:cx,startMY:cy,startPX:cur.x,startPY:cur.y,moved:false}
    setIsDragging(true)
  }

  function handleClick(){
    if(dragRef.current.moved) return
    if(minimized){ setMinimized(false); return }
    // Kliknięcie podczas snu budzi Malę
    if(state==='sleeping'){
      setState('waking')
      setTimeout(()=>{ if(mountedRef.current) setState('greeting') }, 1200)
      setTimeout(()=>{ if(mountedRef.current){ setState('idle'); fetchContext() } }, 4000)
      return
    }
    if(showBubble){ dismissBubble(); return }
    setPanelView('main'); setPanelOpen(v=>!v)
  }

  function charAnim():React.CSSProperties{
    if(isDragging) return{cursor:'grabbing'}
    switch(state){
      case 'sleeping': return{animation:'ml-sleep 3s ease-in-out infinite',cursor:'grab'}
      case 'waking':   return{animation:'ml-wake 1.5s cubic-bezier(.34,1.56,.64,1) forwards',cursor:'grab'}
      case 'greeting': return{animation:'ml-bob 1.8s ease-in-out infinite',cursor:'pointer'}
      case 'idle':     return{animation:'ml-bob 3.5s ease-in-out infinite',cursor:'pointer'}
      case 'speaking': return{animation:'ml-shake 0.55s ease-in-out 3',cursor:'pointer'}
      case 'alert':    return{animation:'ml-alert 0.6s ease-in-out 4',cursor:'pointer'}
    }
  }

  const isSleeping=state==='sleeping'
  const hasAlerts=ctxLoaded&&context.items.some(i=>i.type==='alert')
  const curPos=pos??defaultPos()
  const vw=typeof window!=='undefined'?window.innerWidth:1200
  const vh=typeof window!=='undefined'?window.innerHeight:800
  const onRight=curPos.x>vw/2; const onBottom=curPos.y>vh/2
  const panelStyle:React.CSSProperties={position:'absolute',width:256,maxHeight:panelView==='help'?430:350,...(onRight?{right:0}:{left:0}),...(onBottom?{bottom:'115%'}:{top:'115%'})}
  const bubbleStyle:React.CSSProperties={position:'absolute',maxWidth:220,...(onRight?{right:0}:{left:0}),...(onBottom?{bottom:'115%'}:{top:'115%'})}

  // ─── Minimized ────────────────────────────────────────────────────────────────
  if(minimized) return (
    <div style={{position:'fixed',left:curPos.x,top:curPos.y,zIndex:1000,cursor:'pointer'}} onMouseDown={startDrag} onTouchStart={startDrag} onClick={handleClick}>
      <div style={{width:50,height:50,borderRadius:'50%',background:'linear-gradient(135deg,#3E2723,#795548)',boxShadow:'0 4px 18px rgba(62,39,35,.5)',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform .2s',fontSize:26}}
           onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.12)')} onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>
        🐒
        {hasAlerts&&<span style={{position:'absolute',top:2,right:2,width:13,height:13,borderRadius:'50%',background:'#f44336',border:'2px solid white'}}/>}
      </div>
      <p style={{textAlign:'center',fontSize:9,color:'#78909C',margin:'3px 0 0',whiteSpace:'nowrap'}}>Kliknij Malę</p>
    </div>
  )

  // ─── Monkey SVG — 3D plush-toy style ────────────────────────────────────────
  const MonkeySVG = () => {
    const isGreeting = state === 'greeting'
    const eyeH = eyesClosed || isSleeping
    const isAlert = state === 'alert'

    return (
      <svg width="100" height="130" viewBox="0 0 200 260" overflow="visible" style={{ display: 'block', pointerEvents: 'none' }}>
        <defs>
          {/* Fur — 3D sphere: lighter top-left, very dark edges */}
          <radialGradient id="mla-fur-head" cx="36%" cy="28%" r="68%">
            <stop offset="0%"  stopColor="#2E1A0C"/>
            <stop offset="42%" stopColor="#1C0E06"/>
            <stop offset="100%" stopColor="#0A0400"/>
          </radialGradient>
          <radialGradient id="mla-fur-body" cx="36%" cy="24%" r="72%">
            <stop offset="0%"  stopColor="#2A1808"/>
            <stop offset="50%" stopColor="#180A04"/>
            <stop offset="100%" stopColor="#090300"/>
          </radialGradient>
          <radialGradient id="mla-ear-l" cx="42%" cy="30%" r="65%">
            <stop offset="0%"  stopColor="#281608"/>
            <stop offset="100%" stopColor="#0C0402"/>
          </radialGradient>
          <radialGradient id="mla-ear-r" cx="58%" cy="30%" r="65%">
            <stop offset="0%"  stopColor="#281608"/>
            <stop offset="100%" stopColor="#0C0402"/>
          </radialGradient>
          {/* Face — warm golden, radial */}
          <radialGradient id="mla-face" cx="38%" cy="30%" r="66%">
            <stop offset="0%"  stopColor="#E2AC6E"/>
            <stop offset="48%" stopColor="#C8783A"/>
            <stop offset="100%" stopColor="#A05A28"/>
          </radialGradient>
          {/* Muzzle — lighter, prominently protruding */}
          <radialGradient id="mla-muzzle" cx="36%" cy="28%" r="70%">
            <stop offset="0%"  stopColor="#F0C485"/>
            <stop offset="50%" stopColor="#D8945C"/>
            <stop offset="100%" stopColor="#AC6430"/>
          </radialGradient>
          {/* Belly */}
          <radialGradient id="mla-belly" cx="36%" cy="26%" r="68%">
            <stop offset="0%"  stopColor="#E0AC6A"/>
            <stop offset="52%" stopColor="#C07A3E"/>
            <stop offset="100%" stopColor="#965A1C"/>
          </radialGradient>
          {/* Inner ear */}
          <radialGradient id="mla-iear-l" cx="40%" cy="34%" r="62%">
            <stop offset="0%"  stopColor="#CC8454"/>
            <stop offset="100%" stopColor="#7E4418"/>
          </radialGradient>
          <radialGradient id="mla-iear-r" cx="60%" cy="34%" r="62%">
            <stop offset="0%"  stopColor="#CC8454"/>
            <stop offset="100%" stopColor="#7E4418"/>
          </radialGradient>
        </defs>

        {/* ── Sezonowe podłoże (TYŁ) ── */}
        <SeasonalGroundBack season={seasonal.season}/>

        {/* ── Cień ── */}
        <ellipse cx="100" cy="249" rx="48" ry="10" fill="rgba(0,0,0,0.18)"/>

        {/* ═══ OGON ═══ */}
        <path d="M150 226 C174 218 186 200 182 183 C178 165 162 161 153 171 C150 177 155 181 160 177"
          stroke="#0C0402" strokeWidth="16" fill="none" strokeLinecap="round"/>
        <path d="M150 226 C174 218 186 200 182 183 C178 165 162 161 153 171 C150 177 155 181 160 177"
          stroke="url(#mla-fur-body)" strokeWidth="13" fill="none" strokeLinecap="round"/>
        <path d="M150 226 C174 218 186 200 182 183 C178 166 163 163 155 172"
          stroke="rgba(255,255,255,0.07)" strokeWidth="5" fill="none" strokeLinecap="round"/>

        {/* ═══ NOGI / STOPY ═══ */}
        <ellipse cx="76"  cy="244" rx="24" ry="12" fill="url(#mla-fur-body)"/>
        <ellipse cx="124" cy="244" rx="24" ry="12" fill="url(#mla-fur-body)"/>
        {/* Paluszki u stóp */}
        {[-6,-2,2,6].map((dx,i)=>(
          <circle key={i} cx={76+dx}  cy={249} r="3.5" fill="#0C0402"/>
        ))}
        {[-6,-2,2,6].map((dx,i)=>(
          <circle key={i} cx={124+dx} cy={249} r="3.5" fill="#0C0402"/>
        ))}
        {/* Stopa highlight */}
        <ellipse cx="72"  cy="241" rx="14" ry="6" fill="rgba(255,255,255,0.06)"/>
        <ellipse cx="120" cy="241" rx="14" ry="6" fill="rgba(255,255,255,0.06)"/>

        {/* ═══ CIAŁO ═══ */}
        <ellipse cx="100" cy="210" rx="64" ry="52" fill="url(#mla-fur-body)"/>
        {/* AO u dołu ciała */}
        <ellipse cx="100" cy="248" rx="56" ry="20" fill="rgba(0,0,0,0.22)"/>
        {/* Ciało highlight */}
        <ellipse cx="70"  cy="184" rx="32" ry="24" fill="rgba(255,255,255,0.06)"/>
        <ellipse cx="65"  cy="179" rx="16" ry="12" fill="rgba(255,255,255,0.04)"/>

        {/* ═══ BRZUSZEK ═══ */}
        <ellipse cx="100" cy="218" rx="36" ry="31" fill="url(#mla-belly)"/>
        <ellipse cx="88"  cy="206" rx="18" ry="13" fill="rgba(255,255,255,0.24)"/>
        <ellipse cx="84"  cy="202" rx="9"  ry="6"  fill="rgba(255,255,255,0.14)"/>
        <ellipse cx="100" cy="240" rx="26" ry="11" fill="rgba(0,0,0,0.14)"/>

        {/* ═══ USZY (za głową) ═══ */}
        {/* LEWE ucho outer */}
        <circle cx="30" cy="112" r="32" fill="url(#mla-ear-l)"/>
        {/* AO łączenie z głową */}
        <ellipse cx="42" cy="112" rx="20" ry="26" fill="rgba(0,0,0,0.28)"/>
        {/* Inner ear */}
        <circle cx="30" cy="112" r="21" fill="url(#mla-iear-l)"/>
        {/* Concave center darker */}
        <circle cx="30" cy="112" r="13" fill="rgba(0,0,0,0.18)"/>
        {/* Inner ear highlight */}
        <ellipse cx="23" cy="105" rx="9" ry="7" fill="rgba(255,255,255,0.26)"/>
        <ellipse cx="20" cy="102" rx="4.5" ry="3.5" fill="rgba(255,255,255,0.16)"/>
        {/* Outer ear highlight */}
        <ellipse cx="20" cy="101" rx="10" ry="7" fill="rgba(255,255,255,0.08)"/>

        {/* PRAWE ucho outer */}
        <circle cx="170" cy="112" r="32" fill="url(#mla-ear-r)"/>
        <ellipse cx="158" cy="112" rx="20" ry="26" fill="rgba(0,0,0,0.28)"/>
        <circle cx="170" cy="112" r="21" fill="url(#mla-iear-r)"/>
        <circle cx="170" cy="112" r="13" fill="rgba(0,0,0,0.18)"/>
        <ellipse cx="177" cy="105" rx="9" ry="7" fill="rgba(255,255,255,0.26)"/>
        <ellipse cx="180" cy="102" rx="4.5" ry="3.5" fill="rgba(255,255,255,0.16)"/>
        <ellipse cx="180" cy="101" rx="10" ry="7" fill="rgba(255,255,255,0.08)"/>

        {/* Wielkanocne uszy królicze */}
        <SeasonalBehindMonkey season={seasonal.season}/>

        {/* ═══ GŁOWA ═══ */}
        <circle cx="100" cy="116" r="70" fill="url(#mla-fur-head)"/>
        {/* Head AO — dół */}
        <ellipse cx="100" cy="176" rx="62" ry="22" fill="rgba(0,0,0,0.20)"/>
        {/* Head specular — góra lewa */}
        <ellipse cx="73"  cy="82" rx="30" ry="22" fill="rgba(255,255,255,0.07)"/>
        <ellipse cx="68"  cy="77" rx="15" ry="11" fill="rgba(255,255,255,0.05)"/>

        {/* ═══ TWARZ — cały front głowy ═══ */}
        <ellipse cx="100" cy="132" rx="52" ry="58" fill="url(#mla-face)"/>
        {/* Face highlight — upper left */}
        <ellipse cx="80"  cy="104" rx="26" ry="20" fill="rgba(255,255,255,0.18)"/>
        <ellipse cx="76"  cy="99"  rx="13" ry="10" fill="rgba(255,255,255,0.12)"/>
        {/* Face AO — where ears meet */}
        <ellipse cx="100" cy="180" rx="46" ry="14" fill="rgba(0,0,0,0.10)"/>

        {/* ═══ PYSK — kulista wypukłość (kluczowy element!) ═══ */}
        <ellipse cx="100" cy="154" rx="38" ry="32" fill="url(#mla-muzzle)"/>
        {/* Muzzle 3D highlight — wyraźny połysk jak na kulce */}
        <ellipse cx="84"  cy="142" rx="18" ry="13" fill="rgba(255,255,255,0.30)"/>
        <ellipse cx="80"  cy="138" rx="9"  ry="6"  fill="rgba(255,255,255,0.20)"/>
        {/* Muzzle AO — dół pyska */}
        <ellipse cx="100" cy="178" rx="32" ry="11" fill="rgba(0,0,0,0.14)"/>
        {/* Muzzle boczne AO */}
        <ellipse cx="66"  cy="154" rx="10" ry="24" fill="rgba(0,0,0,0.08)"/>
        <ellipse cx="134" cy="154" rx="10" ry="24" fill="rgba(0,0,0,0.08)"/>

        {/* ═══ BRWI ═══ */}
        {isSleeping ? (
          <>
            <path d="M66 99 Q80 96 94 99"   stroke="#0A0400" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
            <path d="M106 99 Q120 96 134 99" stroke="#0A0400" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          </>
        ) : (
          <>
            <path d={isAlert ? 'M66 94 Q80 84 94 91'   : 'M66 98 Q80 92 94 97'}
              stroke="#0A0400" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
            <path d={isAlert ? 'M106 91 Q120 84 134 94' : 'M106 97 Q120 92 134 98'}
              stroke="#0A0400" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
            {/* Brew highlight (3D) */}
            <path d={isAlert ? 'M67 93 Q80 84 93 90'    : 'M67 97 Q80 91 93 96'}
              stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </>
        )}

        {/* ═══ OCZY ═══ */}
        {/* Drop shadow pod okiem */}
        <circle cx="81"  cy="117" r="18" fill="rgba(0,0,0,0.22)"/>
        <circle cx="119" cy="117" r="18" fill="rgba(0,0,0,0.22)"/>
        {/* Białka */}
        <circle cx="81"  cy="115" r="17" fill="white"/>
        <circle cx="119" cy="115" r="17" fill="white"/>

        {eyeH ? (
          /* Zamknięte — łuki z rzęsami */
          <>
            <path d="M65 115 Q81 103 97 115"  stroke="#0A0400" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
            <path d="M103 115 Q119 103 135 115" stroke="#0A0400" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
            {/* Rzęsy */}
            <path d="M66 114 Q70 107 74 112"  stroke="#0A0400" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M96 112 Q92 106 88 111"  stroke="#0A0400" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M104 112 Q108 106 112 111"stroke="#0A0400" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M134 114 Q130 107 126 112"stroke="#0A0400" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </>
        ) : (
          <>
            {/* Brązowa tęczówka (iris ring) */}
            <circle cx={isAlert?79:81}  cy={isAlert?113:117} r="14" fill="#2C1408"/>
            <circle cx={isAlert?117:119} cy={isAlert?113:117} r="14" fill="#2C1408"/>
            {/* Czarna źrenica */}
            <circle cx={isAlert?79:81}  cy={isAlert?113:117} r="9"  fill="#060200"/>
            <circle cx={isAlert?117:119} cy={isAlert?113:117} r="9"  fill="#060200"/>
            {/* DUŻY główny refleks (jak na zdjęciu — biały, wyraźny) */}
            <circle cx={isAlert?86:88}  cy={isAlert?107:109} r="5.5" fill="white"/>
            <circle cx={isAlert?124:126} cy={isAlert?107:109} r="5.5" fill="white"/>
            {/* MAŁY dodatkowy refleks */}
            <circle cx={isAlert?83:85}  cy={isAlert?118:120} r="2.5" fill="rgba(255,255,255,0.65)"/>
            <circle cx={isAlert?121:123} cy={isAlert?118:120} r="2.5" fill="rgba(255,255,255,0.65)"/>
            {/* Iris ring highlight */}
            <circle cx={isAlert?79:81}  cy={isAlert?113:117} r="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
          </>
        )}

        {/* ═══ NOS ═══ */}
        <ellipse cx="100" cy="142" rx="10" ry="7.5" fill="#0A0400"/>
        {/* Nozdrza */}
        <circle cx="94.5" cy="143" r="3.5" fill="#050200"/>
        <circle cx="105.5" cy="143" r="3.5" fill="#050200"/>
        {/* Nos highlight */}
        <ellipse cx="96.5" cy="138.5" rx="4" ry="2.8" fill="rgba(255,255,255,0.24)"/>

        {/* ═══ USTA ═══ */}
        {isSleeping ? (
          <path d="M84 162 Q100 169 116 162" stroke="#0A0400" strokeWidth="3" fill="none" strokeLinecap="round"/>
        ) : mouthOpen ? (
          <>
            <ellipse cx="100" cy="167" rx="20" ry="14" fill="#0A0400"/>
            <ellipse cx="100" cy="171" rx="16" ry="9"  fill="#7A1A1A"/>
            <rect    x="89"  y="157"  width="22" height="8" rx="3.5" fill="white"/>
            <rect    x="89"  y="168"  width="22" height="6" rx="3"   fill="#FFD0D0" opacity=".5"/>
          </>
        ) : state === 'greeting' ? (
          /* WIELKI uśmiech — jak na zdjęciu */
          <>
            <path d="M74 158 Q100 182 126 158" stroke="#0A0400" strokeWidth="4" fill="none" strokeLinecap="round"/>
            {/* Widoczne zęby przy wielkim uśmiechu */}
            <path d="M80 161 Q100 174 120 161 Q120 168 100 170 Q80 168 80 161Z" fill="white"/>
            {/* Wyraźne policzki radości */}
            <ellipse cx="66"  cy="140" rx="14" ry="9"  fill="rgba(225,85,55,0.38)"/>
            <ellipse cx="134" cy="140" rx="14" ry="9"  fill="rgba(225,85,55,0.38)"/>
            {/* Mały połysk policzka */}
            <ellipse cx="61"  cy="135" rx="5"  ry="3.5" fill="rgba(255,255,255,0.22)"/>
            <ellipse cx="139" cy="135" rx="5"  ry="3.5" fill="rgba(255,255,255,0.22)"/>
          </>
        ) : (
          <path d="M81 160 Q100 175 119 160" stroke="#0A0400" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        )}

        {/* ═══ RUMIEŃCE (idle/speaking) ═══ */}
        {!isSleeping && state !== 'greeting' && (
          <>
            <circle cx="65"  cy="135" r="13" fill="rgba(215,70,40,0.28)"/>
            <circle cx="135" cy="135" r="13" fill="rgba(215,70,40,0.28)"/>
            <ellipse cx="61"  cy="130" rx="5"  ry="3.5" fill="rgba(255,255,255,0.18)"/>
            <ellipse cx="139" cy="130" rx="5"  ry="3.5" fill="rgba(255,255,255,0.18)"/>
          </>
        )}

        {/* ═══ LEWA RĘKA ═══ */}
        <path
          d={isGreeting
            ? 'M56 204 C40 195 35 180 32 163 C29 148 38 141 49 147 C55 151 58 165 59 183 C60 198 58 208 56 215'
            : 'M55 200 C38 190 33 174 30 157 C27 142 37 136 48 142 C54 147 57 161 58 180 C59 196 57 207 55 215'}
          fill="#150804"
        />
        {/* Reka lewa highlight */}
        <path
          d={isGreeting
            ? 'M50 202 C38 193 34 179 32 165 C30 151 38 144 46 149'
            : 'M49 198 C36 188 32 173 30 158 C28 144 37 138 45 143'}
          stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" strokeLinecap="round"
        />
        {/* Palce lewej ręki */}
        {isGreeting && [-3,0,3].map((dx,i)=>(
          <circle key={i} cx={56+dx} cy={218} r="4" fill="#0C0402"/>
        ))}

        {/* ═══ PRAWA RĘKA ═══ */}
        {isGreeting ? (
          <g>
            <path d="M144 197 C159 174 166 148 164 124 C162 108 152 105 144 111 C137 117 136 136 138 159 C140 178 139 198 137 210"
              fill="#150804"/>
            <path d="M149 196 C162 175 168 151 166 128 C164 112 156 109 149 115"
              stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" strokeLinecap="round"/>
          </g>
        ) : (
          <g>
            <path d="M145 200 C162 190 168 173 170 156 C172 140 162 134 152 141 C145 146 143 160 144 178 C145 192 143 205 141 214"
              fill="#150804"/>
            <path d="M149 199 C164 190 169 174 170 158 C172 143 163 137 154 143"
              stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" strokeLinecap="round"
            />
            {/* Palce prawej ręki (idle) */}
            {[-3,0,3].map((dx,i)=>(
              <circle key={i} cx={141+dx} cy={217} r="4" fill="#0C0402"/>
            ))}
          </g>
        )}

        {/* ═══ KOPERTA + SERCE (stan greeting) ═══ */}
        {isGreeting && (
          <g style={{ animation: 'ml-float 1.6s ease-in-out infinite' }}>
            {/* Cień koperty */}
            <rect x="159" y="69" width="50" height="36" rx="6" fill="rgba(0,0,0,0.18)"/>
            {/* Koperta — tył */}
            <rect x="157" y="63" width="50" height="36" rx="6" fill="#F0DDAD"/>
            {/* Koperta border */}
            <rect x="157" y="63" width="50" height="36" rx="6" fill="none" stroke="#CEB87A" strokeWidth="1.5"/>
            {/* Klapa koperty (V fold) */}
            <path d="M157 63 L182 84 L207 63" fill="#DBC590"/>
            <path d="M157 63 L182 84 L207 63" fill="none" stroke="#C4A460" strokeWidth="1"/>
            {/* Dolne fałdy */}
            <path d="M157 63 L170 76" stroke="#C4A460" strokeWidth="1"/>
            <path d="M207 63 L194 76" stroke="#C4A460" strokeWidth="1"/>
            {/* Koperta highlight */}
            <ellipse cx="171" cy="76" rx="12" ry="7" fill="rgba(255,255,255,0.30)"/>
            <ellipse cx="168" cy="73" rx="5"  ry="3.5" fill="rgba(255,255,255,0.20)"/>

            {/* ═══ SERCE ═══ */}
            <path d="M175 47 C175 43 178 40 181.5 42 C185 40 188 43 188 47 C188 54 181.5 61 181.5 61 C181.5 61 175 54 175 47Z"
              fill="#E53935"/>
            {/* Serce — ambient occlusion dół */}
            <path d="M175 47 C175 43 178 40 181.5 42 C185 40 188 43 188 47 C188 54 181.5 61 181.5 61 C181.5 61 175 54 175 47Z"
              fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"/>
            {/* Serce highlight (połysk) */}
            <ellipse cx="178.5" cy="43.5" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.60)"/>
            <ellipse cx="177"   cy="46"   rx="1.8" ry="1.3" fill="rgba(255,255,255,0.30)"/>
            {/* Serce shadow */}
            <ellipse cx="182" cy="56" rx="4" ry="2.8" fill="rgba(0,0,0,0.14)"/>
          </g>
        )}

        {/* ═══ ZZZ ═══ */}
        {isSleeping && (
          <>
            <text x="150" y="90" fontSize="17" fontWeight="800" fill="#90CAF9"
              style={{ animation: 'ml-zzz 2.2s 0s ease-in-out infinite', opacity: 0 }}>z</text>
            <text x="162" y="73" fontSize="22" fontWeight="800" fill="#64B5F6"
              style={{ animation: 'ml-zzz 2.2s 0.7s ease-in-out infinite', opacity: 0 }}>z</text>
            <text x="174" y="53" fontSize="28" fontWeight="800" fill="#42A5F5"
              style={{ animation: 'ml-zzz 2.2s 1.4s ease-in-out infinite', opacity: 0 }}>Z</text>
          </>
        )}

        {/* Sezonowe podłoże PRZÓD */}
        <SeasonalGroundFront season={seasonal.season}/>
        {/* Sezonowe akcesoria FRONT */}
        <SeasonalFrontMonkey season={seasonal.season}/>
      </svg>
    )
  }

  const itemBg:Record<string,string>    = {alert:'#FFF3F0',warning:'#FFFBE6',info:'#F0F7FF'}
  const itemBorder:Record<string,string> = {alert:'#FFCDD2',warning:'#FFE0B2',info:'#BBDEFB'}
  const itemColor:Record<string,string>  = {alert:'#C62828',warning:'#E65100',info:'#1565C0'}

  const ALL_SHORTCUTS = [
    {href:'/dashboard',     label:'🏠',     title:'Dashboard'},
    {href:'/crm',           label:'📞',     title:'CRM'},
    {href:'/przetargi',     label:'🔍',     title:'Przetargi'},
    {href:'/inwestycje',    label:'🏗',     title:'Inwestycje'},
    {href:'/czasPracy',     label:'⏱',     title:'Czas pracy'},
    {href:'/kadry',         label:'👷',     title:'Kadry'},
    {href:'/place',         label:'💵',     title:'Płace'},
    {href:'/kosztorysowanie',label:'🧮',    title:'Kosztorysowanie'},
    {href:'/klienci',       label:'👥',     title:'Klienci'},
    {href:'/raporty',       label:'📊',     title:'Raporty'},
  ]

  return (
    <div
      style={{position:'fixed',left:curPos.x,top:curPos.y,zIndex:999,userSelect:'none',touchAction:'none'}}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      onClick={handleClick}
    >

      {/* ── DYMEK ── */}
      {showBubble && !panelOpen && (
        <div style={{...bubbleStyle,zIndex:10}}>
          <div
            style={{background:'white',border:'1.5px solid #E0E0E0',borderRadius:16,padding:'11px 14px',
                    boxShadow:'0 6px 24px rgba(0,0,0,0.13)',fontSize:13,lineHeight:1.55,color:'#2D2D2D',cursor:'pointer'}}
            onClick={e=>{ e.stopPropagation(); dismissBubble() }}>
            {state==='alert' && (
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                <span style={{fontSize:14}}>⚠️</span>
                <span style={{fontSize:11,color:'#D32F2F',fontWeight:700}}>Pilna sprawa!</span>
              </div>
            )}
            <div style={{fontWeight:state==='alert'?600:400}}>{bubbleText}</div>
            <div style={{fontSize:10,color:'#BDBDBD',marginTop:7,textAlign:'right'}}>kliknij aby zamknąć ✕</div>
          </div>
          {/* Trójkąt strzałki dymka */}
          <div style={{
            width:14,height:10,margin:`${onBottom?0:-2}px auto`,
            background:'white',clipPath:'polygon(0 0,100% 0,50% 100%)',
            borderTop: onBottom?'none':'1.5px solid #E0E0E0',
          }}/>
        </div>
      )}

      {/* ── PANEL ── */}
      {panelOpen && (
        <div
          style={{...panelStyle,background:'white',border:'1.5px solid #E5E7EB',borderRadius:20,
                  boxShadow:'0 12px 40px rgba(0,0,0,0.16)',overflow:'hidden',zIndex:10}}
          onClick={e=>e.stopPropagation()}>

          {/* ─ HEADER ─ */}
          <div style={{background:'linear-gradient(135deg,#3E2723 0%,#6D4C41 100%)',padding:'13px 14px',
                       display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.15)',
                         display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
              🐒
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:'white',fontWeight:700,fontSize:13,margin:0}}>Mala</p>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {ctxLoaded && context.userName ? `Cześć, ${context.userName}! 👋` : 'Twoja asystentka 🐒'}
              </p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
              {/* Odśwież */}
              <button
                onClick={()=>{ setCtxLoaded(false); fetchContext() }}
                title="Odśwież dane"
                style={{background:'rgba(255,255,255,0.12)',border:'none',cursor:'pointer',
                        color:'rgba(255,255,255,0.8)',fontSize:14,padding:'5px 7px',borderRadius:8,
                        display:'flex',alignItems:'center'}}>
                ↺
              </button>
              {/* Pomoc */}
              <button
                onClick={()=>setPanelView(v=>v==='help'?'main':'help')}
                style={{background:'rgba(255,255,255,0.12)',border:'none',cursor:'pointer',
                        color:'rgba(255,255,255,0.8)',fontSize:12,padding:'5px 8px',borderRadius:8}}>
                {panelView==='help'?'◀':'❓'}
              </button>
              {/* Zamknij panel (bez minimalizacji) */}
              <button
                onClick={()=>setPanelOpen(false)}
                style={{background:'rgba(255,255,255,0.12)',border:'none',cursor:'pointer',
                        color:'rgba(255,255,255,0.8)',fontSize:14,padding:'5px 8px',borderRadius:8}}>
                ✕
              </button>
            </div>
          </div>

          {panelView==='help' ? (
            /* ─ WIDOK POMOCY ─ */
            <div style={{padding:14,maxHeight:370,overflowY:'auto'}}>
              <p style={{fontSize:11,fontWeight:700,color:'#4E342E',marginBottom:10,textTransform:'uppercase',letterSpacing:'.06em'}}>
                Jak korzystać z Mali?
              </p>
              {[
                {icon:'📮',t:'Powitanie z kopertą',d:'Co rano wita Cię z kopertą i serduszkiem — tak jak na zdjęciu 🐒'},
                {icon:'⚠️',t:'Czerwony badge',d:'Masz pilne zadania CRM lub termin przetargu za mniej niż 3 dni'},
                {icon:'🔔',t:'Dymki co jakiś czas',d:'Co 50 sekund wyświetlam losową poradę lub pilne ostrzeżenie'},
                {icon:'😴',t:'Śpię?',d:'Kliknij mnie — obudzę się i otworzę panel z informacjami!'},
                {icon:'✋',t:'Przeciągnij mnie',d:'Złap i przesuń w dowolne miejsce ekranu — pozycja jest zapamiętywana'},
                {icon:'↺',t:'Odśwież',d:'Przycisk ↺ w nagłówku pobiera aktualne dane z systemu'},
                {icon:'🗓',t:'Terminy',d:'Przetargi kończące się w ciągu 7 dni, przeterminowane zadania CRM'},
                {icon:'📄',t:'Kosztorysy',d:'Nowe kosztorysy z ostatniego miesiąca'},
              ].map(i=>(
                <div key={i.t} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:'1px solid #F5F0EE'}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{i.icon}</span>
                  <div>
                    <p style={{fontSize:12,fontWeight:600,color:'#4E342E',margin:'0 0 2px'}}>{i.t}</p>
                    <p style={{fontSize:11,color:'#8D6E63',margin:0,lineHeight:1.4}}>{i.d}</p>
                  </div>
                </div>
              ))}
              {/* Stany Mali */}
              <p style={{fontSize:11,fontWeight:700,color:'#4E342E',margin:'14px 0 8px',textTransform:'uppercase',letterSpacing:'.06em'}}>
                Stany Mali
              </p>
              {[
                {e:'😴',n:'Sleeping',d:'Kiwanie — kliknij aby obudzić'},
                {e:'🌅',n:'Waking',d:'Przeciąganie — właśnie się budzi'},
                {e:'📮',n:'Greeting',d:'Powitanie z kopertą'},
                {e:'😊',n:'Idle',d:'Spokojne mruganie — gotowa do pomocy'},
                {e:'💬',n:'Speaking',d:'Mówi — otwarta buzia, kiwanie'},
                {e:'⚠️',n:'Alert',d:'Wielkie oczy — pilna wiadomość!'},
              ].map(s=>(
                <div key={s.n} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid #F5F0EE'}}>
                  <span style={{fontSize:16,width:24,textAlign:'center'}}>{s.e}</span>
                  <span style={{fontSize:11,fontWeight:600,color:'#6D4C41',width:70}}>{s.n}</span>
                  <span style={{fontSize:11,color:'#9E9E9E'}}>{s.d}</span>
                </div>
              ))}
            </div>
          ) : (
            /* ─ WIDOK GŁÓWNY ─ */
            <div>
              {/* Kontekst — alerty, ostrzeżenia, info */}
              <div style={{maxHeight:260,overflowY:'auto'}}>
                {!ctxLoaded ? (
                  <div style={{padding:24,textAlign:'center'}}>
                    <div style={{fontSize:26,marginBottom:6,animation:'ml-bob 1.5s ease-in-out infinite'}}>🐒</div>
                    <p style={{fontSize:12,color:'#9E9E9E',margin:0}}>Ładuję dane systemu...</p>
                  </div>
                ) : context.items.length===0 ? (
                  <div style={{padding:22,textAlign:'center'}}>
                    <div style={{fontSize:30,marginBottom:6}}>🎉</div>
                    <p style={{fontSize:13,fontWeight:600,color:'#4E342E',margin:'0 0 4px'}}>Wszystko w porządku!</p>
                    <p style={{fontSize:11,color:'#9E9E9E',margin:0}}>Brak pilnych spraw na dziś.</p>
                  </div>
                ) : (
                  <div style={{padding:'10px 10px 4px'}}>
                    <p style={{fontSize:10,fontWeight:700,color:'#9E9E9E',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.08em'}}>
                      Twoje sprawy ({context.items.length})
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      {context.items.map((item,i)=>{
                        const isPrzetarg = item.rekordTyp==='przetarg' && item.rekordId
                        const commonInner = (
                          <div style={{display:'flex',alignItems:'flex-start',gap:9}}>
                            <span style={{fontSize:18,flexShrink:0,lineHeight:1}}>{item.icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:12,fontWeight:600,color:itemColor[item.type],margin:0,lineHeight:1.4}}>{item.text}</p>
                              {item.detail && (
                                <p style={{fontSize:11,color:'#757575',margin:'2px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.detail}</p>
                              )}
                            </div>
                            <span style={{fontSize:14,color:itemColor[item.type],flexShrink:0,opacity:.7}}>{isPrzetarg?'⋯':'›'}</span>
                          </div>
                        )
                        const cardStyle:React.CSSProperties={display:'block',width:'100%',textAlign:'left',textDecoration:'none',
                          background:itemBg[item.type],border:`1.5px solid ${itemBorder[item.type]}`,borderRadius:12,padding:'9px 11px',
                          cursor:'pointer',transition:'transform .12s, box-shadow .12s'}
                        const hoverIn=(e:React.MouseEvent)=>{ (e.currentTarget as HTMLElement).style.transform='scale(1.02)'; (e.currentTarget as HTMLElement).style.boxShadow='0 3px 12px rgba(0,0,0,0.10)' }
                        const hoverOut=(e:React.MouseEvent)=>{ (e.currentTarget as HTMLElement).style.transform='scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow='none' }
                        return isPrzetarg ? (
                          <button key={i} onClick={()=>setPreview(item)} style={cardStyle}
                            onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            {commonInner}
                          </button>
                        ) : (
                          <a key={i} href={item.href}
                            onClick={()=>{ setPanelOpen(false); showMsg(item.text,'alert') }}
                            style={cardStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            {commonInner}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div style={{height:1,background:'linear-gradient(90deg,transparent,#EDE0D4,transparent)',margin:'4px 0'}}/>

              {/* Siatka skrótów */}
              <div style={{padding:'10px 10px 4px'}}>
                <p style={{fontSize:10,fontWeight:700,color:'#9E9E9E',margin:'0 0 7px',textTransform:'uppercase',letterSpacing:'.08em'}}>
                  Szybki dostęp
                </p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4}}>
                  {ALL_SHORTCUTS.map(s=>(
                    <a key={s.href} href={s.href} onClick={()=>setPanelOpen(false)}
                      title={s.title}
                      style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'7px 4px',
                              borderRadius:10,background:'#FBF6F3',border:'1px solid #EDE0D4',textDecoration:'none',
                              transition:'background .12s,transform .12s'}}
                      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='#F0E6E0'; (e.currentTarget as HTMLElement).style.transform='scale(1.08)' }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='#FBF6F3'; (e.currentTarget as HTMLElement).style.transform='scale(1)' }}>
                      <span style={{fontSize:18}}>{s.label}</span>
                      <span style={{fontSize:9,color:'#8D6E63',textAlign:'center',fontWeight:500,lineHeight:1.2}}>
                        {s.title.length>7 ? s.title.slice(0,7)+'…' : s.title}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Stopka — miniatura */}
              <div style={{padding:'6px 10px 10px',display:'flex',justifyContent:'flex-end'}}>
                <button
                  onClick={()=>{ setPanelOpen(false); setMinimized(true) }}
                  style={{fontSize:10,color:'#BCAAA4',background:'none',border:'none',cursor:'pointer',padding:'3px 6px',
                          borderRadius:6,display:'flex',alignItems:'center',gap:4}}>
                  <span>⊝</span> Minimalizuj
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PODGLĄD PRZETARGU + PODMENU AKCJI ══ */}
      {preview && (
        <div
          style={{...panelStyle, width:268, maxHeight:'none', background:'white',
                  border:'1.5px solid #E5E7EB', borderRadius:18,
                  boxShadow:'0 12px 40px rgba(0,0,0,0.18)', overflow:'hidden', zIndex:11}}
          onClick={e=>e.stopPropagation()}>
          {/* Header podglądu */}
          <div style={{background:'linear-gradient(135deg,#B91C1C,#DC2626)',padding:'12px 14px',display:'flex',alignItems:'flex-start',gap:9}}>
            <span style={{fontSize:20,flexShrink:0}}>{preview.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:'white',fontWeight:700,fontSize:12,margin:0,lineHeight:1.35}}>{preview.text}</p>
              {preview.data && (
                <p style={{color:'rgba(255,255,255,0.8)',fontSize:10,margin:'3px 0 0'}}>
                  📅 Termin składania: {new Date(preview.data).toLocaleDateString('pl-PL')}
                </p>
              )}
            </div>
            <button onClick={()=>setPreview(null)}
              style={{background:'rgba(255,255,255,0.18)',border:'none',cursor:'pointer',color:'white',
                      fontSize:13,padding:'3px 7px',borderRadius:7,flexShrink:0}}>✕</button>
          </div>

          {/* Tytuł przetargu */}
          <div style={{padding:'12px 14px',borderBottom:'1px solid #F0F0F0'}}>
            <p style={{fontSize:10,fontWeight:700,color:'#9E9E9E',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.06em'}}>Przetarg</p>
            <p style={{fontSize:13,fontWeight:600,color:'#1F2937',margin:0,lineHeight:1.4}}>
              {preview.detail || 'Przetarg publiczny'}
            </p>
          </div>

          {actionMsg && (
            <div style={{padding:'8px 14px',background:'#F0FDF4',color:'#15803D',fontSize:11,fontWeight:600,textAlign:'center'}}>
              {actionMsg}
            </div>
          )}

          {/* Podmenu akcji */}
          <div style={{padding:8,display:'flex',flexDirection:'column',gap:4}}>
            {[
              {k:'przejdz',  icon:'🔗', label:'Przejdź do przetargu', color:'#1565C0', bg:'#EFF6FF'},
              {k:'obserwuj', icon:'★',  label:'Obserwuj',             color:'#B45309', bg:'#FFFBEB'},
              {k:'przypomnij',icon:'🔔', label:'Przypomnij później (4h)',color:'#6D28D9', bg:'#F5F3FF'},
              {k:'odrzuc',   icon:'⏭',  label:'Odrzuć (pomiń)',        color:'#4B5563', bg:'#F9FAFB'},
              {k:'usun',     icon:'🗑', label:'Usuń przetarg',         color:'#DC2626', bg:'#FEF2F2'},
            ].map(a=>(
              <button key={a.k}
                onClick={()=>{
                  if(a.k==='przejdz'){
                    const id=preview.rekordId
                    setPreview(null); setPanelOpen(false)
                    if(!id) return
                    try { localStorage.setItem('przetarg-open', id) } catch {}
                    // Unikalny param `t` wymusza pełne przeładowanie nawet gdy już jesteśmy na /przetargi
                    window.location.href = `/przetargi?open=${encodeURIComponent(id)}&t=${Date.now()}`
                  } else {
                    przetargAkcja(preview, a.k as any)
                  }
                }}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',textAlign:'left',
                        padding:'10px 12px',borderRadius:10,border:'none',cursor:'pointer',
                        background:a.bg,color:a.color,fontSize:12.5,fontWeight:600,
                        transition:'filter .12s'}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.filter='brightness(0.96)'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.filter='none'}}>
                <span style={{fontSize:15,width:18,textAlign:'center'}}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Postać małpki ── */}
      <div style={{...charAnim(),width:100,height:130,flexShrink:0,position:'relative',cursor:isSleeping?'grab':'pointer'}}>
        {/* SVG bezpośrednio skalowane — bez dodatkowego diva */}
        <MonkeySVG/>
        {/* Alert badge */}
        {hasAlerts&&!panelOpen&&!showBubble&&(
          <div style={{position:'absolute',top:2,right:2,width:14,height:14,borderRadius:'50%',background:'#F44336',border:'2px solid white',animation:'ml-alert 0.6s ease-in-out infinite',zIndex:2}}/>
        )}
      </div>
    </div>
  )
}
