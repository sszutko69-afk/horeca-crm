'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────
type MascotState = 'sleeping' | 'waking' | 'greeting' | 'idle' | 'speaking' | 'alert'
type PanelView   = 'main' | 'help'
type Season = 'christmas' | 'newyear' | 'valentine' | 'easter' | 'spring' | 'summer' | 'autumn' | 'halloween' | 'winter' | 'normal'

interface ContextItem { type:'alert'|'warning'|'info'; text:string; href:string; icon:string; detail?:string; rekordId?:string; rekordTyp?:string; data?:string }
interface ContextData { userName:string; items:ContextItem[] }
interface Pos         { x:number; y:number }

// ─── Season detection ──────────────────────────────────────────────────────────
function detectSeason(): { season:Season; emoji:string; greeting:string } {
  const now = new Date(); const m = now.getMonth()+1; const d = now.getDate()
  if (m===12 && d>=1  && d<=26)                  return { season:'christmas', emoji:'🎅', greeting:'Wesołych Świąt Bożego Narodzenia! 🎄' }
  if ((m===12&&d>=27)||(m===1&&d<=5))             return { season:'newyear',  emoji:'🎉', greeting:'Szczęśliwego Nowego Roku! 🥳' }
  if (m===2  && d>=11 && d<=15)                   return { season:'valentine', emoji:'💘', greeting:'Szczęśliwych Walentynek! ❤️' }
  if ((m===3&&d>=20)||(m===4&&d<=25))             return { season:'easter',   emoji:'🐣', greeting:'Wesołego Alleluja! Zdrowych Świąt! 🐰' }
  if (m>=3 && m<=5)                               return { season:'spring',   emoji:'🌸', greeting:'Pięknej wiosny i słonecznej pogody! 🌼' }
  if ((m>=6&&m<=8)||(m===9&&d<=15))               return { season:'summer',   emoji:'☀️', greeting:'Udanych wakacji i słonecznych dni! 🏄' }
  if (m===10 && d>=25)                            return { season:'halloween',emoji:'🎃', greeting:'Happy Halloween! Czary-mary! 🧙' }
  if ((m===9&&d>=16)||m===10||(m===11&&d<=14))    return { season:'autumn',   emoji:'🍂', greeting:'Kolorowej złotej jesieni! 🍁' }
  if ((m===11&&d>=15)||m===12||(m===1&&d>=6&&d<=14))return{season:'winter',  emoji:'❄️', greeting:'Ciepłej i przytulnej zimy! ⛄' }
  return { season:'normal', emoji:'🔥', greeting:'' }
}

// ─── Seasonal accessories (rendered BEHIND body — e.g. bunny ears) ─────────────
function SeasonalBehind({ season }: { season:Season }) {
  if (season === 'easter') return (
    <g>
      <ellipse cx="78"  cy="44" rx="11" ry="25" fill="white"/>
      <ellipse cx="78"  cy="44" rx="6"  ry="18" fill="#FFCDD2"/>
      <ellipse cx="122" cy="44" rx="11" ry="25" fill="white"/>
      <ellipse cx="122" cy="44" rx="6"  ry="18" fill="#FFCDD2"/>
    </g>
  )
  return null
}

// ─── Seasonal accessories (rendered FRONT — on top of everything) ──────────────
function SeasonalFront({ season }: { season:Season }) {
  switch (season) {

    // ── Christmas: Santa hat ────────────────────────────────────────────────────
    case 'christmas': return (
      <g>
        {/* White brim */}
        <ellipse cx="100" cy="78" rx="49" ry="12" fill="white"/>
        {/* Red cone */}
        <path d="M55 76 C60 52 74 32 88 20 C92 14 97 10 100 10 C103 10 108 14 112 20 C126 32 140 52 145 76Z" fill="#C62828"/>
        {/* Shade on cone */}
        <path d="M100 10 C103 10 108 14 112 20 C124 32 138 52 144 76 L130 76 C125 55 115 36 106 22 C103 16 101 12 100 10Z" fill="rgba(0,0,0,0.12)"/>
        {/* White brim overlap */}
        <ellipse cx="100" cy="78" rx="49" ry="10" fill="white"/>
        {/* Pom-pom */}
        <circle cx="101" cy="10" r="10" fill="white"/>
        <circle cx="101" cy="10" r="7"  fill="rgba(255,255,255,0.6)"/>
        {/* Jingle bell */}
        <ellipse cx="36" cy="155" rx="8" ry="9" fill="#FFD700"/>
        <ellipse cx="36" cy="152" rx="8" ry="6" fill="#FFC107"/>
        <rect x="33" y="146" width="6" height="4" rx="2" fill="#A1887F"/>
        <rect x="35" y="158" width="2" height="3" rx="1" fill="#795548"/>
      </g>
    )

    // ── New Year: party hat + confetti ──────────────────────────────────────────
    case 'newyear': return (
      <g>
        <ellipse cx="100" cy="68" rx="38" ry="10" fill="#7B1FA2"/>
        <path d="M65 68 C70 48 82 30 92 18 C95 12 98 9 100 9 C102 9 105 12 108 18 C118 30 130 48 135 68Z" fill="#9C27B0"/>
        {/* Stripes */}
        <path d="M100 9 C102 9 104 11 107 17 C116 30 128 49 134 68 L128 68 C122 50 112 32 105 19 C103 13 101 10 100 9Z" fill="rgba(255,235,59,.6)"/>
        <path d="M100 9 C101 9 102 10 103 12 C110 26 120 46 126 68 L120 68 C115 48 107 29 103 17 C101 12 100 9 100 9Z" fill="rgba(255,255,255,.25)"/>
        <ellipse cx="100" cy="68" rx="38" ry="9" fill="#6A1B9A"/>
        <circle cx="100" cy="9" r="8" fill="#FFEB3B"/>
        {/* Confetti */}
        <rect x="150" y="58" width="8" height="4" rx="1" fill="#FF5252" transform="rotate(35 154 60)" style={{animation:'gz-zzz 2.2s .2s ease-in-out infinite'}} opacity="0"/>
        <rect x="33"  y="65" width="7" height="3" rx="1" fill="#40C4FF" transform="rotate(-25 36 66)" style={{animation:'gz-zzz 2.2s .7s ease-in-out infinite'}} opacity="0"/>
        <rect x="158" y="88" width="6" height="6" rx="1" fill="#FFEB3B" transform="rotate(50 161 91)" style={{animation:'gz-zzz 2.2s 1.1s ease-in-out infinite'}} opacity="0"/>
        <rect x="28"  y="92" width="8" height="3" rx="1" fill="#69F0AE" transform="rotate(15 32 93)"  style={{animation:'gz-zzz 2.2s 1.5s ease-in-out infinite'}} opacity="0"/>
        <circle cx="162" cy="73" r="3.5" fill="#FF80AB" style={{animation:'gz-zzz 2.2s 0s ease-in-out infinite'}} opacity="0"/>
        <circle cx="28"  cy="78" r="3"   fill="#EA80FC" style={{animation:'gz-zzz 2.2s .9s ease-in-out infinite'}} opacity="0"/>
      </g>
    )

    // ── Valentine: hearts ────────────────────────────────────────────────────────
    case 'valentine': return (
      <g>
        {/* Big heart above head */}
        <path d="M100 52 C100 52 87 39 80 46 C73 53 78 62 100 78 C122 62 127 53 120 46 C113 39 100 52 100 52Z"
              fill="#E91E63" opacity=".92" style={{animation:'gz-float 1.8s ease-in-out infinite'}}/>
        {/* Pink cheek glow */}
        <ellipse cx="68"  cy="133" rx="16" ry="10" fill="#FF80AB" opacity=".38"/>
        <ellipse cx="132" cy="133" rx="16" ry="10" fill="#FF80AB" opacity=".38"/>
        {/* Floating small hearts */}
        <path d="M155 62 C155 62 151 58 149 60 C147 62 149 65 155 70 C161 65 163 62 161 60 C159 58 155 62 155 62Z"
              fill="#E91E63" opacity=".7" style={{animation:'gz-float 2.2s .4s ease-in-out infinite'}}/>
        <path d="M38 55 C38 55 35 52 33 54 C31 56 32 59 38 63 C44 59 45 56 43 54 C41 52 38 55 38 55Z"
              fill="#FF4081" opacity=".6" style={{animation:'gz-float 2.5s .9s ease-in-out infinite'}}/>
      </g>
    )

    // ── Easter: egg in hand ──────────────────────────────────────────────────────
    case 'easter': return (
      <g>
        {/* Colorful easter egg replacing wrench */}
        <ellipse cx="168" cy="152" rx="13" ry="17" fill="#E91E63"/>
        <path d="M155 152 Q168 140 181 152" stroke="#FFEB3B" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <path d="M155 152 Q168 164 181 152" stroke="#4CAF50" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <circle cx="163" cy="144" r="3" fill="#FFEB3B"/>
        <circle cx="172" cy="160" r="3" fill="#4CAF50"/>
        <circle cx="168" cy="152" r="2.5" fill="white" opacity=".5"/>
      </g>
    )

    // ── Spring: flower bouquet on hat ───────────────────────────────────────────
    case 'spring': return (
      <g>
        {/* Petals */}
        {[0,45,90,135,180,225,270,315].map(a => {
          const r = a*Math.PI/180; const px = 100+9*Math.cos(r); const py = 58+9*Math.sin(r)
          return <ellipse key={a} cx={px} cy={py} rx="4.5" ry="7" fill="#EC407A" opacity=".9"
                          transform={`rotate(${a} ${px} ${py})`}/>
        })}
        <circle cx="100" cy="58" r="6" fill="#FFEB3B"/>
        {/* Small flower on left side */}
        {[0,90,180,270].map(a => {
          const r=a*Math.PI/180; const px=38+6*Math.cos(r); const py=90+6*Math.sin(r)
          return <ellipse key={a} cx={px} cy={py} rx="3" ry="5" fill="#64B5F6" opacity=".85"
                          transform={`rotate(${a} ${px} ${py})`}/>
        })}
        <circle cx="38" cy="90" r="4" fill="#FFEB3B"/>
        {/* Grass/stem */}
        <path d="M97 64 L95 74" stroke="#66BB6A" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M103 64 L105 74" stroke="#66BB6A" strokeWidth="1.5" strokeLinecap="round"/>
      </g>
    )

    // ── Summer: straw hat + sunglasses + surfboard ──────────────────────────────
    case 'summer': return (
      <g>
        {/* Straw hat brim — wide */}
        <ellipse cx="100" cy="78" rx="58" ry="11" fill="#8D6E63"/>
        {/* Hat dome */}
        <path d="M54 78 C56 52 70 42 100 40 C130 42 144 52 146 78Z" fill="#A1887F"/>
        <path d="M56 78 C58 54 72 44 100 42 C128 44 142 54 144 78Z" fill="#BCAAA4"/>
        {/* Hat band */}
        <path d="M60 73 Q100 69 140 73" stroke="#4CAF50" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <path d="M60 73 Q100 69 140 73" stroke="#81C784" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Straw texture lines */}
        <path d="M70 68 Q100 65 130 68" stroke="rgba(121,85,72,.3)" strokeWidth="1" fill="none"/>
        <path d="M72 73 Q100 70 128 73" stroke="rgba(121,85,72,.3)" strokeWidth="1" fill="none"/>
        {/* Sunglasses frames */}
        <ellipse cx="83"  cy="122" rx="15" ry="12" fill="rgba(2,62,138,.82)"/>
        <ellipse cx="117" cy="122" rx="15" ry="12" fill="rgba(2,62,138,.82)"/>
        {/* Lens shine */}
        <ellipse cx="79"  cy="118" rx="4"  ry="3"  fill="rgba(255,255,255,.28)"/>
        <ellipse cx="113" cy="118" rx="4"  ry="3"  fill="rgba(255,255,255,.28)"/>
        {/* Frame rings */}
        <ellipse cx="83"  cy="122" rx="15" ry="12" fill="none" stroke="#212121" strokeWidth="2"/>
        <ellipse cx="117" cy="122" rx="15" ry="12" fill="none" stroke="#212121" strokeWidth="2"/>
        {/* Bridge */}
        <path d="M98 122 Q100 119 102 122" stroke="#212121" strokeWidth="2" fill="none"/>
        {/* Side arms */}
        <path d="M68 122 Q59 120 53 124" stroke="#212121" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M132 122 Q141 120 147 124" stroke="#212121" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* Surfboard in left arm */}
        <rect x="10" y="104" width="18" height="46" rx="9" fill="#FF7043" transform="rotate(-22 19 127)"/>
        <rect x="10" y="104" width="18" height="46" rx="9" fill="none" stroke="#E64A19" strokeWidth="1.5" transform="rotate(-22 19 127)"/>
        <path d="M13 107 L27 147" stroke="white" strokeWidth="1.2" strokeLinecap="round" transform="rotate(-22 19 127)" opacity=".7"/>
        <circle cx="19" cy="127" r="3" fill="white" opacity=".6" transform="rotate(-22 19 127)"/>
      </g>
    )

    // ── Autumn: scarf + leaf ────────────────────────────────────────────────────
    case 'autumn': return (
      <g>
        {/* Scarf across chest */}
        <path d="M55 163 Q100 153 145 163 L145 172 Q100 163 55 172Z" fill="#D84315"/>
        <path d="M55 172 Q100 163 145 172 L145 179 Q100 170 55 179Z" fill="#FF7043"/>
        {/* Scarf end hanging */}
        <rect x="56" y="179" width="20" height="28" rx="8" fill="#D84315"/>
        <path d="M56 179 L76 179 L76 207 Q66 214 56 207Z" fill="#D84315"/>
        <path d="M60 182 L72 182 L72 207 Q66 212 60 207Z" fill="#FF8A65"/>
        {/* Falling leaf */}
        <path d="M160 58 C165 50 175 52 174 62 C173 70 162 72 158 65 Z"
              fill="#FF8F00" style={{animation:'gz-float 2.5s ease-in-out infinite', transformBox:'fill-box', transformOrigin:'center'}}/>
        <path d="M160 58 C167 56 174 60 174 62" stroke="#E65100" strokeWidth="1" fill="none"/>
        <path d="M163 50 L161 72" stroke="#8D6E63" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Second leaf */}
        <path d="M28 70 C32 61 42 64 40 74 C38 81 27 82 25 75 Z"
              fill="#FF6F00" opacity=".85" style={{animation:'gz-float 2s .7s ease-in-out infinite', transformBox:'fill-box', transformOrigin:'center'}}/>
      </g>
    )

    // ── Halloween: witch hat + pumpkin ──────────────────────────────────────────
    case 'halloween': return (
      <g>
        {/* Witch hat wide brim */}
        <ellipse cx="100" cy="78" rx="55" ry="13" fill="#1A1A1A"/>
        {/* Cone shadow on brim */}
        <path d="M73 78 C76 60 85 42 93 28 C96 20 99 14 100 10 C101 14 104 20 107 28 C115 42 124 60 127 78Z" fill="rgba(0,0,0,0.3)"/>
        {/* Hat cone */}
        <path d="M73 78 C76 60 85 42 93 28 C96 20 99 14 100 10 C101 14 104 20 107 28 C115 42 124 60 127 78Z" fill="#212121"/>
        {/* Brim rim */}
        <ellipse cx="100" cy="78" rx="55" ry="11" fill="#1A1A1A"/>
        {/* Hat band */}
        <rect x="74" y="70" width="52" height="10" rx="0" fill="#6A1B9A" opacity=".9"/>
        {/* Belt buckle */}
        <rect x="93" y="69" width="14" height="12" rx="1" fill="#FFC107"/>
        <rect x="95" y="71" width="10" height="8"  rx="1" fill="#212121"/>
        {/* Purple accent stripe on cone */}
        <path d="M83 62 Q100 59 117 62 Q116 55 100 53 Q84 55 83 62Z" fill="#7B1FA2" opacity=".6"/>
        {/* Pumpkin replacing wrench */}
        <ellipse cx="168" cy="148" rx="14" ry="13" fill="#F57C00"/>
        <path d="M158 148 C158 140 163 135 168 135 C173 135 178 140 178 148 C178 156 173 161 168 161 C163 161 158 156 158 148Z" fill="#FF8F00"/>
        {/* Pumpkin ridges */}
        <path d="M168 135 L168 161" stroke="#E65100" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
        {/* Pumpkin stem */}
        <path d="M167 135 C167 130 170 127 172 124" stroke="#388E3C" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        {/* Pumpkin face */}
        <path d="M162 146 L165 142 L168 146Z" fill="#1A1A1A"/>
        <path d="M168 146 L171 142 L174 146Z" fill="#1A1A1A"/>
        <path d="M161 152 Q164 157 168 154 Q172 157 175 152" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
        {/* Bat */}
        <path d="M35 55 C30 48 25 52 28 57 C28 57 35 60 35 55Z" fill="#424242"/>
        <path d="M35 55 C40 48 45 52 42 57 C42 57 35 60 35 55Z" fill="#424242"/>
        <circle cx="35" cy="55" r="4" fill="#424242"/>
        <circle cx="33" cy="53" r="1" fill="#FF5252"/>
        <circle cx="37" cy="53" r="1" fill="#FF5252"/>
      </g>
    )

    // ── Winter: snowflake + scarf ───────────────────────────────────────────────
    case 'winter': return (
      <g>
        {/* Scarf */}
        <path d="M58 163 Q100 153 142 163 L142 172 Q100 162 58 172Z" fill="#1565C0"/>
        <path d="M58 172 Q100 162 142 172 L142 179 Q100 170 58 179Z" fill="#42A5F5"/>
        <rect x="59" y="179" width="18" height="26" rx="7" fill="#1565C0"/>
        {/* Snowflakes */}
        {[[150,55],[35,62],[158,88],[25,90],[145,42]].map(([x,y],i) => (
          <g key={i} style={{animation:`gz-float ${2+i*.3}s ${i*.4}s ease-in-out infinite`, transformBox:'fill-box', transformOrigin:'center'}}>
            <line x1={x-7} y1={y}   x2={x+7} y2={y}   stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1={x}   y1={y-7} x2={x}   y2={y+7} stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1={x-5} y1={y-5} x2={x+5} y2={y+5} stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1={x+5} y1={y-5} x2={x-5} y2={y+5} stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round"/>
          </g>
        ))}
      </g>
    )

    default: return null
  }
}

// ─── Seasonal ground — layer BEHIND feet ──────────────────────────────────────
function SeasonalGroundBack({ season }: { season: Season }) {
  switch (season) {

    case 'spring': return (
      <g>
        {/* Dark soil base */}
        <rect x="-10" y="222" width="220" height="26" fill="#558B2F"/>
        {/* Wavy grass top */}
        <path d="M-10 222 C0 213 12 220 24 213 C36 206 48 218 60 213 C72 208 84 218 96 213 C108 208 120 218 132 213 C144 208 156 218 168 213 C180 208 192 218 210 222Z"
              fill="#7CB342"/>
        {/* Lighter grass blades */}
        {[8,38,68,100,132,162,192].map((x,i)=>(
          <path key={x} d={`M${x} 220 C${x+3} ${209+i%2*3} ${x+6} 217 ${x+8} ${210+i%2*2} L${x+8} 222 L${x} 222Z`} fill="#8BC34A" opacity=".75"/>
        ))}
        {/* Daisies */}
        {[[45,217],[155,218],[22,220],[178,219]].map(([dx,dy],fi)=>(
          <g key={fi}>
            {[0,36,72,108,144,180,216,252,288,324].map(a=>{
              const r=a*Math.PI/180
              return <ellipse key={a} cx={dx+5*Math.cos(r)} cy={dy+5*Math.sin(r)} rx="1.8" ry="3.2"
                              fill={fi%2===0?'white':'#FF80AB'} opacity=".9"
                              transform={`rotate(${a} ${dx+5*Math.cos(r)} ${dy+5*Math.sin(r)})`}/>
            })}
            <circle cx={dx} cy={dy} r="2.8" fill="#FFEB3B"/>
          </g>
        ))}
        {/* Small red & purple wildflowers */}
        {[[74,219,'#FF5722'],[128,218,'#AB47BC'],[200,220,'#FF5722']].map(([fx,fy,fc])=>(
          <g key={`${fx}`}>
            {[0,60,120,180,240,300].map(a=>{const r=a*Math.PI/180; return <ellipse key={a} cx={(fx as number)+4*Math.cos(r)} cy={(fy as number)+4*Math.sin(r)} rx="1.5" ry="2.5" fill={fc as string} opacity=".9" transform={`rotate(${a} ${(fx as number)+4*Math.cos(r)} ${(fy as number)+4*Math.sin(r)})`}/>})}
            <circle cx={fx as number} cy={fy as number} r="2" fill="#FFEB3B"/>
          </g>
        ))}
      </g>
    )

    case 'summer': return (
      <g>
        {/* Sea/water horizon */}
        <rect x="-10" y="213" width="220" height="11" fill="#0288D1" opacity=".55"/>
        {/* Gentle wave */}
        <path d="M-10 213 C5 208 18 213 33 208 C48 203 61 210 76 208 C91 206 104 211 119 208 C134 205 147 210 162 208 C177 206 190 211 210 213Z"
              fill="#29B6F6" opacity=".65"/>
        {/* Sandy beach */}
        <path d="M-10 220 Q25 215 55 220 Q85 215 115 220 Q145 215 175 220 Q200 215 220 220 L220 248 L-10 248Z"
              fill="#F5D76E"/>
        <rect x="-10" y="222" width="220" height="22" fill="#E8C44A"/>
        {/* Sand ripple lines */}
        <path d="M5  228 Q30 225 55 228"  stroke="#C9A830" strokeWidth="1" fill="none" opacity=".55"/>
        <path d="M50 232 Q80 229 110 232" stroke="#C9A830" strokeWidth="1" fill="none" opacity=".55"/>
        <path d="M105 228 Q135 225 165 228" stroke="#C9A830" strokeWidth="1" fill="none" opacity=".55"/>
        <path d="M150 233 Q180 230 205 233" stroke="#C9A830" strokeWidth="1" fill="none" opacity=".55"/>
        {/* Seashell */}
        <path d="M30 223 C28 218 35 216 37 221 C39 216 44 218 42 223Z" fill="#FFCCBC"/>
        <path d="M36 223 L36 216" stroke="#FFAB91" strokeWidth="1.2" fill="none"/>
        {/* Starfish */}
        {[0,72,144,216,288].map(a=>{const r=a*Math.PI/180; return <line key={a} x1="168" y1="224" x2={168+7*Math.cos(r)} y2={224+7*Math.sin(r)} stroke="#FF7043" strokeWidth="2.5" strokeLinecap="round"/>})}
        <circle cx="168" cy="224" r="2.5" fill="#FF5722"/>
        {/* Tiny umbrella stick */}
        <line x1="185" y1="215" x2="188" y2="228" stroke="#795548" strokeWidth="2" strokeLinecap="round"/>
        <path d="M178 215 Q186 208 194 215Z" fill="#F44336"/>
        <path d="M178 215 Q186 212 194 215" stroke="#FFEB3B" strokeWidth="1.5" fill="none"/>
      </g>
    )

    case 'autumn': return (
      <g>
        {/* Dark soil */}
        <rect x="-10" y="224" width="220" height="22" fill="#5D4037"/>
        <path d="M-10 224 Q25 220 55 224 Q85 220 115 224 Q145 220 175 224 Q200 220 220 224Z" fill="#6D4C41"/>
        {/* Leaf carpet — lower layer */}
        {[
          [20, 225, '#BF360C', -18],[42, 223, '#E65100',  12],[65, 226, '#FF6D00',  -8],
          [88, 224, '#F57C00',  20],[112,225, '#BF360C', -25],[135,223, '#FF8F00',  15],
          [158,226, '#E65100', -10],[180,224, '#FF6D00',  22],[200,225, '#F57C00', -15],
        ].map(([lx,ly,lc,lr])=>(
          <ellipse key={lx} cx={lx as number} cy={ly as number} rx="13" ry="5.5" fill={lc as string}
                   transform={`rotate(${lr} ${lx} ${ly})`} opacity=".9"/>
        ))}
        {/* Leaf carpet — upper brighter layer */}
        {[
          [32, 221, '#FF8F00',  30],[58, 220, '#FF6D00', -15],[82, 222, '#FFCC02',  10],
          [108,221, '#BF360C',  25],[132,220, '#FF8F00', -20],[158,222, '#FFCC02',  8],
          [182,221, '#E65100', -28],
        ].map(([lx,ly,lc,lr])=>(
          <ellipse key={lx} cx={lx as number} cy={ly as number} rx="10" ry="4.5" fill={lc as string}
                   transform={`rotate(${lr} ${lx} ${ly})`} opacity=".95"/>
        ))}
        {/* Leaf veins */}
        {[[20,225],[65,224],[112,223],[158,224]].map(([vx,vy])=>(
          <path key={vx} d={`M${vx-8} ${vy} L${vx+8} ${vy}`} stroke="#8D3200" strokeWidth=".8" fill="none" opacity=".45"/>
        ))}
      </g>
    )

    case 'winter': return (
      <g>
        {/* Snow base */}
        <rect x="-10" y="226" width="220" height="22" fill="#E3F2FD"/>
        {/* Snow bumpy surface */}
        <path d="M-10 226 Q2 217 16 222 Q30 213 44 220 Q58 211 72 218 Q86 210 100 216 Q114 210 128 216 Q142 212 156 219 Q170 213 184 220 Q198 214 212 222 Q218 218 222 226Z"
              fill="white"/>
        {/* Inner shadow on snow */}
        <path d="M-10 226 Q2 217 16 222 Q30 213 44 220 Q58 211 72 218 Q86 210 100 216 Q114 210 128 216 Q142 212 156 219 Q170 213 184 220 Q198 214 212 222 Q218 218 222 226Z"
              fill="#BBDEFB" opacity=".3"/>
        {/* Snow sparkle dots */}
        {[[22,222],[52,218],[82,220],[112,216],[142,219],[168,221],[194,218]].map(([sx,sy],i)=>(
          <circle key={sx} cx={sx} cy={sy} r={i%2===0?1.8:1.2} fill="#90CAF9" opacity=".8"/>
        ))}
        {/* Snowballs */}
        <circle cx="48"  cy="226" r="6"   fill="white"/><circle cx="48"  cy="226" r="6"   fill="none" stroke="#BBDEFB" strokeWidth="1"/>
        <circle cx="44"  cy="230" r="4.5" fill="white"/><circle cx="44"  cy="230" r="4.5" fill="none" stroke="#BBDEFB" strokeWidth="1"/>
        <circle cx="158" cy="226" r="5.5" fill="white"/><circle cx="158" cy="226" r="5.5" fill="none" stroke="#BBDEFB" strokeWidth="1"/>
        <circle cx="163" cy="230" r="4"   fill="white"/><circle cx="163" cy="230" r="4"   fill="none" stroke="#BBDEFB" strokeWidth="1"/>
        {/* Footprints in snow */}
        <ellipse cx="84"  cy="226" rx="5" ry="2.5" fill="#BBDEFB" opacity=".55"/>
        <ellipse cx="116" cy="226" rx="5" ry="2.5" fill="#BBDEFB" opacity=".55"/>
      </g>
    )

    default: return null
  }
}

// ─── Seasonal ground — tiny bits IN FRONT of feet ─────────────────────────────
function SeasonalGroundFront({ season }: { season: Season }) {
  switch (season) {
    case 'spring': return (
      <g>
        {/* Grass blades poking in front of shoes */}
        {[78,90,104,116,128].map((x,i)=>(
          <path key={x} d={`M${x} 228 C${x+1} ${220+i%2*3} ${x+3} 225 ${x+4} ${221+i%2*2}`}
                stroke="#66BB6A" strokeWidth="2" strokeLinecap="round" fill="none"/>
        ))}
      </g>
    )
    case 'summer': return (
      <g>
        {/* Sand grains at feet */}
        {[[75,226],[90,228],[112,226],[128,228],[95,230],[105,230]].map(([x,y])=>(
          <circle key={x} cx={x} cy={y} r="1.5" fill="#E8C44A" opacity=".7"/>
        ))}
      </g>
    )
    case 'autumn': return (
      <g>
        {/* A few leaves landing on/around shoes */}
        <ellipse cx="76"  cy="224" rx="9" ry="3.5" fill="#FF8F00" transform="rotate(20 76 224)" opacity=".9"/>
        <ellipse cx="124" cy="223" rx="8" ry="3"   fill="#BF360C" transform="rotate(-15 124 223)" opacity=".9"/>
        <ellipse cx="98"  cy="225" rx="7" ry="3"   fill="#FFCC02" transform="rotate(30 98 225)" opacity=".85"/>
      </g>
    )
    case 'winter': return (
      <g>
        {/* Snow piled at feet */}
        <path d="M68 226 Q83 220 98 226 Q100 222 102 226 Q117 220 132 226Z" fill="white" opacity=".95"/>
        <path d="M70 226 Q83 221 96 226 Q100 223 104 226 Q117 221 130 226Z" fill="#E3F2FD" opacity=".4"/>
      </g>
    )
    default: return null
  }
}

// ─── Greeting ──────────────────────────────────────────────────────────────────
function getGreeting(name: string) {
  const h = new Date().getHours(); const n = name ? `, ${name}` : ''
  if (h>=5  && h<12) return `Dzień dobry${n}! Miło Cię widzieć 🔥`
  if (h>=12 && h<18) return `Cześć${n}! Jak idzie dziś? ⚡`
  if (h>=18 && h<23) return `Dobry wieczór${n}! Jeszcze w robocie? 💪`
  return `Hej${n}! Nie śpisz? Ja zawsze na posterunku! 🔧`
}

const TIPS = [
  'Kosztorys AI generuje się w kilka sekund — spróbuj! 🤖',
  'Sprawdź Przetargi — nowe ogłoszenia mogą czekać! 📋',
  'Pamiętaj o archiwizacji danych w module Backup. 💾',
  'Mapa klientów pokazuje zasięg geograficzny firmy. 🗺️',
  'Raporty mają analizę sprzedaży i zakupów. 📊',
  'Cysterna & GPS śledzi trasę kierowcy na żywo. 🚛',
  'AI — Finanse odpowie na każde pytanie o dane. 💡',
]

// ─── CSS keyframes ─────────────────────────────────────────────────────────────
function injectKeyframes() {
  if (typeof document==='undefined'||document.getElementById('gz-kf')) return
  const s = document.createElement('style'); s.id='gz-kf'
  s.textContent = `
    @keyframes gz-bob    {0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-8px) rotate(1.5deg)}}
    @keyframes gz-sleep  {0%,100%{transform:rotate(-82deg) translate(28px,22px)}50%{transform:rotate(-82deg) translate(28px,22px) scale(1.03)}}
    @keyframes gz-wake   {0%{transform:rotate(-82deg) translate(28px,22px) scale(.9);opacity:.6}55%{transform:rotate(9deg) translate(-3px,-5px)}75%{transform:rotate(-4deg)}100%{transform:none;opacity:1}}
    @keyframes gz-shake  {0%,100%{transform:translateX(0)}20%{transform:translateX(-5px) rotate(-2deg)}40%{transform:translateX(5px) rotate(2deg)}60%{transform:translateX(-3px)}80%{transform:translateX(4px)}}
    @keyframes gz-alert  {0%,100%{transform:translateY(0)}12%{transform:translateY(-18px) rotate(-7deg)}28%{transform:translateY(-10px) rotate(7deg)}44%{transform:translateY(-20px) rotate(-5deg)}60%{transform:translateY(-8px)}76%{transform:translateY(-14px)}}
    @keyframes gz-zzz    {0%{opacity:0;transform:translate(0,0) scale(.5)}15%{opacity:1}80%{opacity:.8}100%{opacity:0;transform:translate(-18px,-28px) scale(1.3)}}
    @keyframes gz-bubble {0%{opacity:0;transform:scale(.75) translateY(14px)}100%{opacity:1;transform:none}}
    @keyframes gz-panel  {0%{opacity:0;transform:scale(.9) translateY(8px)}100%{opacity:1;transform:none}}
    @keyframes gz-cursor {0%,100%{opacity:1}50%{opacity:0}}
    @keyframes gz-wave   {0%,100%{transform:rotate(0)}30%{transform:rotate(-28deg)}70%{transform:rotate(22deg)}}
    @keyframes gz-mouth  {0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.35)}}
    @keyframes gz-float  {0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes gz-drag-hint {0%,100%{opacity:.4}50%{opacity:.9}}
  `
  document.head.appendChild(s)
}

// ─── Typewriter ─────────────────────────────────────────────────────────────────
function useTypewriter(text:string, active:boolean) {
  const [displayed,setDisplayed]=useState(''); const [done,setDone]=useState(false)
  useEffect(()=>{
    setDisplayed(''); setDone(false)
    if(!text||!active) return
    let i=0; let t:ReturnType<typeof setTimeout>
    const tick=()=>{ i++; setDisplayed(text.slice(0,i)); if(i>=text.length){setDone(true);return}; t=setTimeout(tick,30) }
    t=setTimeout(tick,30)
    return ()=>clearTimeout(t)
  },[text,active])
  return { displayed, done }
}

// ─── Eye ─────────────────────────────────────────────────────────────────────────
function Eye({cx,cy,closed}:{cx:number;cy:number;closed:boolean}) {
  return closed ? <ellipse cx={cx} cy={cy} rx={11} ry={1.5} fill="#1565C0"/> : (
    <g>
      <ellipse cx={cx} cy={cy-1} rx={13} ry={14} fill="white"/>
      <circle  cx={cx} cy={cy}   r={9}           fill="#1976D2"/>
      <circle  cx={cx} cy={cy+1} r={5}           fill="#0D1117"/>
      <circle  cx={cx-3} cy={cy-3} r={2.8}       fill="white"/>
    </g>
  )
}

// ─── Help panel ─────────────────────────────────────────────────────────────────
const MODULES=[
  {icon:'👥',name:'CRM',           desc:'Zarządzaj relacjami: kontakty, zadania, aktywności.'},
  {icon:'🏗️',name:'Inwestycje',    desc:'Ewidencja projektów inwestycyjnych i ich statusów.'},
  {icon:'📋',name:'Kosztorysowanie',desc:'Kosztorysy ręcznie lub z pomocą AI (Claude).'},
  {icon:'📣',name:'Przetargi',      desc:'Przetargi z BZP/TED, terminy, statusy, dokumenty.'},
  {icon:'🚛',name:'Cysterna & GPS', desc:'Trasy dostaw, lokalizacja cysterny na żywo.'},
  {icon:'🗺️',name:'Mapa klientów', desc:'Wizualizacja klientów na mapie Google.'},
  {icon:'📊',name:'Raporty',        desc:'Analiza sprzedaży, zakupów, marży.'},
  {icon:'👷',name:'Kadry',          desc:'Pracownicy, czas pracy, plan, płace.'},
]

function HelpPanel({onBack}:{onBack:()=>void}) {
  const {season,emoji} = detectSeason()
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'#1565C0',fontSize:18,padding:0,lineHeight:1}}>←</button>
        <p style={{margin:0,fontSize:13,fontWeight:700,color:'#032D60'}}>🔥 Pomoc — GazCRM</p>
      </div>
      <div style={{overflowY:'auto',flex:1,paddingRight:2}}>
        {season!=='normal' && (
          <div style={{background:'linear-gradient(135deg,#E3F2FD,#F3E5F5)',borderRadius:10,padding:'8px 12px',marginBottom:10,fontSize:12,color:'#4A148C',fontWeight:600}}>
            {emoji} Sezon: {detectSeason().greeting || 'aktualny'}
          </div>
        )}
        <p style={{margin:'0 0 5px',fontSize:11,fontWeight:700,color:'#1565C0',textTransform:'uppercase',letterSpacing:'.06em'}}>Twój asystent Gazek</p>
        <div style={{display:'flex',flexDirection:'column',gap:3,marginBottom:12}}>
          {[['😴','Śpi','leży na boku ze ZZZ — zaraz się ocknie!'],['🌅','Budzi się','sprężynowe wstanie po zalogowaniu'],['👋','Wita','macha ręką, mówi dzień dobry z imieniem'],['🔥','Idle','kołysze się — kliknij po panel ze sprawami'],['💬','Mówi','drży z przejęcia gdy ma wiadomość'],['⚠️','Alert','podskakuje — pilna sprawa!']].map(([em,st,desc])=>(
            <div key={st} style={{display:'flex',gap:6,alignItems:'flex-start',fontSize:12}}>
              <span style={{width:18,flexShrink:0}}>{em}</span>
              <span style={{fontWeight:600,color:'#032D60',width:68,flexShrink:0}}>{st}</span>
              <span style={{color:'#607D8B',lineHeight:1.35}}>{desc}</span>
            </div>
          ))}
        </div>
        <div style={{background:'#F0F7FF',borderRadius:8,padding:'7px 10px',marginBottom:12,fontSize:11,color:'#1565C0',lineHeight:1.5}}>
          <b>Wskazówki:</b> Kliknij Gazka → panel spraw · Przeciągnij → zmień miejsce · Kliknij bańkę → zamknij · × → minimalizuj<br/>
          <b>Stroje sezonowe:</b> Gazek zmienia strój automatycznie wg daty 🎅☀️🐣🎃
        </div>
        <p style={{margin:'0 0 5px',fontSize:11,fontWeight:700,color:'#1565C0',textTransform:'uppercase',letterSpacing:'.06em'}}>Moduły systemu</p>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {MODULES.map(m=>(
            <div key={m.name} style={{display:'flex',gap:7,alignItems:'flex-start',fontSize:12}}>
              <span style={{width:20,flexShrink:0,fontSize:14}}>{m.icon}</span>
              <div><p style={{margin:0,fontWeight:600,color:'#032D60'}}>{m.name}</p><p style={{margin:0,color:'#607D8B',lineHeight:1.3}}>{m.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function GazekAssistant() {
  const [state,      setState]      = useState<MascotState>('sleeping')
  const [minimized,  setMinimized]  = useState(false)
  const [panelOpen,  setPanelOpen]  = useState(false)
  const [panelView,  setPanelView]  = useState<PanelView>('main')
  const [bubbleText, setBubbleText] = useState('')
  const [showBubble, setShowBubble] = useState(false)
  const [eyesClosed, setEyesClosed] = useState(false)
  const [context,    setContext]    = useState<ContextData>({userName:'',items:[]})
  const [ctxLoaded,  setCtxLoaded]  = useState(false)
  const [pos,        setPos]        = useState<Pos|null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [preview,    setPreview]    = useState<ContextItem|null>(null)
  const [actionMsg,  setActionMsg]  = useState('')

  const tipIdxRef  = useRef(0)
  const bubbleTRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const mountedRef = useRef(true)
  const posRef     = useRef<Pos|null>(null)
  const dragRef    = useRef({active:false,startMX:0,startMY:0,startPX:0,startPY:0,moved:false})
  const supabase   = useRef(createClient())
  const seasonal   = detectSeason()

  const {displayed,done} = useTypewriter(bubbleText, showBubble)

  function updatePos(p:Pos) { posRef.current=p; setPos(p) }
  function defaultPos():Pos {
    if(typeof window==='undefined') return {x:20,y:20}
    return {x:window.innerWidth-140, y:window.innerHeight-180}
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    injectKeyframes(); mountedRef.current=true
    try {
      const saved=localStorage.getItem('gazek-pos')
      if(saved){ const p:Pos=JSON.parse(saved); p.x=Math.max(0,Math.min(window.innerWidth-110,p.x)); p.y=Math.max(0,Math.min(window.innerHeight-130,p.y)); updatePos(p) }
      else updatePos(defaultPos())
    } catch { updatePos(defaultPos()) }

    const t1=setTimeout(()=>{ if(mountedRef.current) setState('waking')   },900)
    const t2=setTimeout(()=>{ if(mountedRef.current) setState('greeting') },2300)
    const t3=setTimeout(()=>{ if(mountedRef.current) setState('idle')     },7500)
    fetchContext()
    return ()=>{ mountedRef.current=false; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); if(bubbleTRef.current) clearTimeout(bubbleTRef.current) }
  },[])

  // ─── Drag ───────────────────────────────────────────────────────────────────
  useEffect(()=>{
    function onMove(e:MouseEvent|TouchEvent){
      if(!dragRef.current.active) return
      const cx='touches' in e?e.touches[0].clientX:e.clientX; const cy='touches' in e?e.touches[0].clientY:e.clientY
      const dx=cx-dragRef.current.startMX; const dy=cy-dragRef.current.startMY
      if(Math.abs(dx)>4||Math.abs(dy)>4) dragRef.current.moved=true
      if(!dragRef.current.moved) return
      updatePos({x:Math.max(0,Math.min(window.innerWidth-110,dragRef.current.startPX+dx)),y:Math.max(0,Math.min(window.innerHeight-130,dragRef.current.startPY+dy))})
    }
    function onEnd(){
      if(!dragRef.current.active) return
      dragRef.current.active=false; setIsDragging(false)
      if(dragRef.current.moved&&posRef.current) localStorage.setItem('gazek-pos',JSON.stringify(posRef.current))
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('touchmove',onMove,{passive:true})
    window.addEventListener('mouseup',onEnd);    window.addEventListener('touchend',onEnd)
    return ()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('touchmove',onMove); window.removeEventListener('mouseup',onEnd); window.removeEventListener('touchend',onEnd) }
  },[])

  // ─── Greeting bubble ────────────────────────────────────────────────────────
  useEffect(()=>{ if(state!=='greeting') return; setBubbleText(getGreeting(context.userName)); setShowBubble(true) },[state])
  useEffect(()=>{ if(state==='greeting') setBubbleText(getGreeting(context.userName)) },[context.userName])
  useEffect(()=>{
    if(state!=='idle') return
    const t=setTimeout(()=>{
      if(!mountedRef.current) return
      setShowBubble(false)
      // Show seasonal greeting once after first idle
      if(seasonal.greeting) {
        setTimeout(()=>{ if(mountedRef.current) showMsg(seasonal.greeting, 'speaking') }, 1500)
      }
    },4000)
    return ()=>clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state])

  // ─── Blinking ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!['idle','speaking','greeting'].includes(state)) return
    const schedule=():ReturnType<typeof setTimeout>=>setTimeout(()=>{
      if(!mountedRef.current) return
      setEyesClosed(true); setTimeout(()=>{ if(mountedRef.current) setEyesClosed(false) },140)
      blinkT=schedule()
    },2200+Math.random()*3800)
    let blinkT=schedule(); return ()=>clearTimeout(blinkT)
  },[state])

  // ─── Periodic tips ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(state!=='idle') return
    const iv=setInterval(()=>{
      if(!mountedRef.current||panelOpen) return
      const alertItems=context.items.filter(i=>i.type==='alert')
      const msg=alertItems.length>0&&tipIdxRef.current%3===0 ? alertItems[0].text : TIPS[tipIdxRef.current%TIPS.length]
      tipIdxRef.current++
      showMsg(msg, alertItems.length>0&&tipIdxRef.current%3===1?'alert':'speaking')
    },50000)
    return ()=>clearInterval(iv)
  },[state,context.items,panelOpen])

  // ─── Snooze ("przypomnij później") ───────────────────────────────────────────
  function getSnoozed(): Record<string,number> {
    if(typeof window==='undefined') return {}
    try { return JSON.parse(localStorage.getItem('gaz-snooze')||'{}') } catch { return {} }
  }
  function snoozeItem(id:string, hours=4){
    const s=getSnoozed(); s[id]=Date.now()+hours*3600000
    localStorage.setItem('gaz-snooze',JSON.stringify(s))
  }

  // ─── Context fetch ───────────────────────────────────────────────────────────
  async function fetchContext() {
    try {
      const {data:{session}}=await supabase.current.auth.getSession()
      if(!session) return
      const res=await fetch('/api/gazek-context',{headers:{Authorization:`Bearer ${session.access_token}`}})
      if(!res.ok) return
      const data:ContextData=await res.json()
      const snoozed=getSnoozed(); const now=Date.now()
      data.items=(data.items||[]).filter(i=>!(i.rekordId&&snoozed[i.rekordId]&&snoozed[i.rekordId]>now))
      if(mountedRef.current){setContext(data);setCtxLoaded(true)}
    } catch{}
  }

  // ─── Akcje na przetargu z podglądu ─────────────────────────────────────────
  function flashAction(msg:string){ setActionMsg(msg); setTimeout(()=>{ if(mountedRef.current) setActionMsg('') },2500) }
  async function przetargAkcja(item:ContextItem, akcja:'usun'|'odrzuc'|'obserwuj'|'przypomnij'){
    const id=item.rekordId; if(!id) return
    const sb=supabase.current
    if(akcja==='usun'){ await sb.from('przetargi').update({usuniete:true,usuniete_at:new Date().toISOString()}).eq('id',id); flashAction('🗑 Przetarg usunięty') }
    else if(akcja==='odrzuc'){ await sb.from('przetargi').update({status:'pominiety'}).eq('id',id); flashAction('⏭ Przetarg odrzucony') }
    else if(akcja==='obserwuj'){ await sb.from('przetargi').update({obserwowany:true,status:'obserwowany'}).eq('id',id); flashAction('★ Dodano do obserwowanych') }
    else if(akcja==='przypomnij'){ snoozeItem(id,4); flashAction('🔔 Przypomnę za 4 godziny') }
    setContext(c=>({...c,items:c.items.filter(i=>i.rekordId!==id)}))
    setPreview(null)
  }

  const showMsg=useCallback((text:string,nextState:MascotState='speaking')=>{
    if(bubbleTRef.current) clearTimeout(bubbleTRef.current)
    setPanelOpen(false); setState(nextState); setBubbleText(text); setShowBubble(true)
    bubbleTRef.current=setTimeout(()=>{ if(mountedRef.current){setShowBubble(false);setState('idle')} },Math.max(5000,text.length*65))
  },[])

  function dismissBubble(){ if(bubbleTRef.current) clearTimeout(bubbleTRef.current); setShowBubble(false); if(state==='speaking'||state==='alert') setState('idle') }

  function startDrag(e:React.MouseEvent|React.TouchEvent){
    if('button' in e&&e.button!==0) return
    e.stopPropagation()
    const cx='touches' in e?e.touches[0].clientX:e.clientX; const cy='touches' in e?e.touches[0].clientY:e.clientY
    const cur=posRef.current??defaultPos()
    dragRef.current={active:true,startMX:cx,startMY:cy,startPX:cur.x,startPY:cur.y,moved:false}
    setIsDragging(true)
  }

  function handleClick(){ if(dragRef.current.moved) return; if(minimized){setMinimized(false);return}; if(state==='sleeping') return; if(showBubble){dismissBubble();return}; setPanelView('main'); setPanelOpen(v=>!v) }

  function charAnim():React.CSSProperties{
    if(isDragging) return {cursor:'grabbing'}
    switch(state){
      case 'sleeping': return {animation:'gz-sleep 3s ease-in-out infinite',cursor:'grab'}
      case 'waking':   return {animation:'gz-wake 1.5s cubic-bezier(.34,1.56,.64,1) forwards',cursor:'grab'}
      case 'greeting': return {animation:'gz-bob 2s ease-in-out infinite',cursor:'pointer'}
      case 'idle':     return {animation:'gz-bob 3.5s ease-in-out infinite',cursor:'pointer'}
      case 'speaking': return {animation:'gz-shake 0.6s ease-in-out 3',cursor:'pointer'}
      case 'alert':    return {animation:'gz-alert 0.65s ease-in-out 4',cursor:'pointer'}
    }
  }

  const isSleeping=state==='sleeping'; const isTalking=state==='speaking'||state==='greeting'; const isWaving=state==='greeting'||state==='speaking'
  const hasAlerts=ctxLoaded&&context.items.some(i=>i.type==='alert')
  const curPos=pos??defaultPos()
  const vw=typeof window!=='undefined'?window.innerWidth:1200; const vh=typeof window!=='undefined'?window.innerHeight:800
  const onRight=curPos.x>vw/2; const onBottom=curPos.y>vh/2
  const panelStyle:React.CSSProperties={position:'absolute',width:256,maxHeight:panelView==='help'?430:350,...(onRight?{right:0}:{left:0}),...(onBottom?{bottom:'115%'}:{top:'115%'})}
  const bubbleStyle:React.CSSProperties={position:'absolute',maxWidth:224,...(onRight?{right:0}:{left:0}),...(onBottom?{bottom:'115%'}:{top:'115%'})}
  const itemBg:Record<string,string>={alert:'#FFF3F0',warning:'#FFFBE6',info:'#F0F7FF'}
  const itemBorder:Record<string,string>={alert:'#FFCDD2',warning:'#FFE0B2',info:'#BBDEFB'}

  // ─── Minimized ──────────────────────────────────────────────────────────────
  if(minimized) return (
    <div style={{position:'fixed',left:curPos.x,top:curPos.y,zIndex:1000,cursor:'pointer'}} onMouseDown={startDrag} onTouchStart={startDrag} onClick={handleClick}>
      <div style={{width:50,height:50,borderRadius:'50%',background:'linear-gradient(135deg,#1565C0,#42A5F5)',boxShadow:'0 4px 18px rgba(21,101,192,.45)',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform .2s'}}
           onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.12)')} onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
          <path d="M12 2C10 5.5 7.5 4.5 8 7.5C6.5 5.5 5 7 5.5 9.5C4 8 4 10 5 12C6 10 7 11 7.5 12.5C8 10.5 9.5 11 10 12.5C10.5 10.5 11.5 10 12 12.5C12.5 10 13.5 10.5 14 12.5C14.5 11 16 10 16.5 12.5C17.5 10 17 8 15.5 9.5C16 7 14.5 5.5 13 7.5C13.5 4.5 10 5.5 12 2Z" fill="white" opacity=".95"/>
        </svg>
        {hasAlerts&&<span style={{position:'absolute',top:2,right:2,width:13,height:13,borderRadius:'50%',background:'#f44336',border:'2px solid white'}}/>}
      </div>
      <p style={{textAlign:'center',fontSize:9,color:'#78909C',margin:'3px 0 0',whiteSpace:'nowrap'}}>Kliknij Gazka</p>
    </div>
  )

  return (
    <div style={{position:'fixed',left:curPos.x,top:curPos.y,zIndex:1000,userSelect:'none'}}>
      <div style={{position:'relative'}}>

        {/* ── PANEL ────────────────────────────────────────────────────────────── */}
        {panelOpen && (
          <div onClick={e=>e.stopPropagation()} style={{...panelStyle,background:'white',borderRadius:16,padding:'14px 14px 12px',boxShadow:'0 8px 32px rgba(0,0,50,.18)',border:'1.5px solid #e3f2fd',animation:'gz-panel .3s cubic-bezier(.34,1.56,.64,1) forwards',display:'flex',flexDirection:'column',overflow:'hidden',zIndex:10}}>
            {panelView==='help' ? <HelpPanel onBack={()=>setPanelView('main')}/> : (
              <>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div>
                    <p style={{margin:0,fontSize:13,fontWeight:700,color:'#032D60'}}>{context.userName?`Cześć, ${context.userName}! ${seasonal.emoji}`:'Cześć! 👋'}</p>
                    <p style={{margin:'2px 0 0',fontSize:11,color:'#78909C'}}>{new Date().toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'})}</p>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    <button onClick={()=>setPanelView('help')} title="Pomoc" style={{width:26,height:26,borderRadius:'50%',background:'#F0F4FF',border:'1px solid #DBEAFE',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#1565C0',fontWeight:700}}>?</button>
                    <button onClick={()=>setPanelOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9E9E9E',fontSize:18,lineHeight:1,padding:2}}>×</button>
                  </div>
                </div>
                <div style={{overflowY:'auto',flex:1}}>
                  {ctxLoaded&&context.items.length>0 ? (
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      {context.items.slice(0,5).map((item,i)=>{
                        const isPrzetarg = item.rekordTyp==='przetarg' && !!item.rekordId
                        const inner = (<>
                          <p style={{margin:0,fontSize:12,fontWeight:600,color:'#1a237e'}}>{item.icon} {item.text}{isPrzetarg&&<span style={{float:'right',color:'#90A4AE'}}>⋯</span>}</p>
                          {item.detail&&<p style={{margin:'2px 0 0',fontSize:11,color:'#607D8B',lineHeight:1.35}}>{item.detail}</p>}
                        </>)
                        const st:React.CSSProperties={display:'block',width:'100%',textAlign:'left',padding:'7px 10px',borderRadius:10,background:itemBg[item.type],border:`1px solid ${itemBorder[item.type]}`,textDecoration:'none',cursor:'pointer',transition:'transform .15s'}
                        const mIn=(e:React.MouseEvent)=>((e.currentTarget as HTMLElement).style.transform='translateX(-2px)')
                        const mOut=(e:React.MouseEvent)=>((e.currentTarget as HTMLElement).style.transform='none')
                        return isPrzetarg ? (
                          <button key={i} onClick={()=>setPreview(item)} style={st} onMouseEnter={mIn} onMouseLeave={mOut}>{inner}</button>
                        ) : (
                          <a key={i} href={item.href} onClick={()=>setPanelOpen(false)} style={st} onMouseEnter={mIn} onMouseLeave={mOut}>{inner}</a>
                        )
                      })}
                    </div>
                  ):<p style={{textAlign:'center',padding:'10px 0',color:'#90A4AE',fontSize:12,margin:0}}>{ctxLoaded?'✅ Wszystko pod kontrolą!':'Ładuję dane…'}</p>}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:10,paddingTop:8,borderTop:'1px solid #EEF2F6'}}>
                  {[{l:'CRM',href:'/crm'},{l:'Przetargi',href:'/przetargi'},{l:'Kosztorysy',href:'/kosztorysowanie'},{l:'Raporty',href:'/raporty'}].map(lk=>(
                    <a key={lk.href} href={lk.href} onClick={()=>setPanelOpen(false)}
                       style={{padding:'3px 10px',borderRadius:20,background:'#F0F4FF',border:'1px solid #DBEAFE',color:'#1565C0',fontSize:11,fontWeight:600,textDecoration:'none'}}
                       onMouseEnter={e=>((e.currentTarget as HTMLElement).style.background='#DBEAFE')}
                       onMouseLeave={e=>((e.currentTarget as HTMLElement).style.background='#F0F4FF')}
                    >{lk.l}</a>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PODGLĄD PRZETARGU + PODMENU ──────────────────────────────────────── */}
        {preview&&(
          <div onClick={e=>e.stopPropagation()}
               style={{...panelStyle,width:268,maxHeight:'none',background:'white',borderRadius:16,
                       boxShadow:'0 12px 40px rgba(0,0,50,.22)',border:'1.5px solid #e3f2fd',overflow:'hidden',zIndex:11}}>
            <div style={{background:'linear-gradient(135deg,#B91C1C,#DC2626)',padding:'12px 14px',display:'flex',alignItems:'flex-start',gap:9}}>
              <span style={{fontSize:20,flexShrink:0}}>{preview.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:'white',fontWeight:700,fontSize:12,margin:0,lineHeight:1.35}}>{preview.text}</p>
                {preview.data&&<p style={{color:'rgba(255,255,255,.8)',fontSize:10,margin:'3px 0 0'}}>📅 Termin: {new Date(preview.data).toLocaleDateString('pl-PL')}</p>}
              </div>
              <button onClick={()=>setPreview(null)} style={{background:'rgba(255,255,255,.18)',border:'none',cursor:'pointer',color:'white',fontSize:13,padding:'3px 7px',borderRadius:7,flexShrink:0}}>✕</button>
            </div>
            <div style={{padding:'12px 14px',borderBottom:'1px solid #F0F0F0'}}>
              <p style={{fontSize:10,fontWeight:700,color:'#9E9E9E',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.06em'}}>Przetarg</p>
              <p style={{fontSize:13,fontWeight:600,color:'#1F2937',margin:0,lineHeight:1.4}}>{preview.detail||'Przetarg publiczny'}</p>
            </div>
            {actionMsg&&<div style={{padding:'8px 14px',background:'#F0FDF4',color:'#15803D',fontSize:11,fontWeight:600,textAlign:'center'}}>{actionMsg}</div>}
            <div style={{padding:8,display:'flex',flexDirection:'column',gap:4}}>
              {[
                {k:'przejdz',  icon:'🔗',label:'Przejdź do przetargu',     color:'#1565C0',bg:'#EFF6FF'},
                {k:'obserwuj', icon:'★', label:'Obserwuj',                 color:'#B45309',bg:'#FFFBEB'},
                {k:'przypomnij',icon:'🔔',label:'Przypomnij później (4h)',  color:'#6D28D9',bg:'#F5F3FF'},
                {k:'odrzuc',   icon:'⏭', label:'Odrzuć (pomiń)',           color:'#4B5563',bg:'#F9FAFB'},
                {k:'usun',     icon:'🗑',label:'Usuń przetarg',            color:'#DC2626',bg:'#FEF2F2'},
              ].map(a=>(
                <button key={a.k}
                  onClick={()=>{
                    if(a.k==='przejdz'){
                      const id=preview.rekordId; setPreview(null); setPanelOpen(false)
                      if(!id) return
                      try{localStorage.setItem('przetarg-open',id)}catch{}
                      window.location.href=`/przetargi?open=${encodeURIComponent(id)}&t=${Date.now()}`
                    } else { przetargAkcja(preview, a.k as any) }
                  }}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',textAlign:'left',padding:'10px 12px',borderRadius:10,border:'none',cursor:'pointer',background:a.bg,color:a.color,fontSize:12.5,fontWeight:600}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.filter='brightness(0.96)'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.filter='none'}}>
                  <span style={{fontSize:15,width:18,textAlign:'center'}}>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── BUBBLE ───────────────────────────────────────────────────────────── */}
        {showBubble&&!panelOpen&&(
          <div onClick={e=>{e.stopPropagation();dismissBubble()}}
               style={{...bubbleStyle,background:'white',borderRadius:'14px 14px 4px 14px',padding:'10px 14px 8px',boxShadow:'0 4px 20px rgba(0,0,50,.16)',fontSize:13,lineHeight:1.55,color:'#1a237e',fontWeight:500,border:'1.5px solid #e3f2fd',animation:'gz-bubble .35s cubic-bezier(.34,1.56,.64,1) forwards',cursor:'pointer',zIndex:10}}>
            {displayed}
            {!done&&<span style={{animation:'gz-cursor .65s infinite',marginLeft:1,opacity:.8}}>▍</span>}
            {done&&(
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:5}}>
                <button onClick={e=>{e.stopPropagation();dismissBubble();setPanelView('help');setPanelOpen(true)}}
                        style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#1565C0',fontWeight:600,padding:0}}>❓ Pomoc</button>
                <span style={{fontSize:10,color:'#90A4AE'}}>kliknij aby zamknąć</span>
              </div>
            )}
          </div>
        )}

        {/* ── CHARACTER ────────────────────────────────────────────────────────── */}
        <div style={{display:'flex',alignItems:'flex-end',gap:4}}>
          <button onClick={e=>{e.stopPropagation();setMinimized(true)}} title="Minimalizuj"
                  style={{alignSelf:'flex-start',marginTop:4,width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.9)',border:'1px solid #E0E0E0',cursor:'pointer',fontSize:13,color:'#BDBDBD',padding:0,boxShadow:'0 1px 4px rgba(0,0,0,.1)',display:'flex',alignItems:'center',justifyContent:'center'}}
                  onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#F44336')}
                  onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#BDBDBD')}>×</button>

          <div style={{position:'relative'}}>
            {hasAlerts&&state==='idle'&&!panelOpen&&(
              <span style={{position:'absolute',top:8,right:4,zIndex:2,width:11,height:11,borderRadius:'50%',background:'#F44336',border:'2px solid white',animation:'gz-float 1.5s ease-in-out infinite'}}/>
            )}
            {state==='idle'&&!isDragging&&(
              <div style={{position:'absolute',top:-18,left:'50%',transform:'translateX(-50%)',fontSize:10,color:'#90A4AE',whiteSpace:'nowrap',animation:'gz-drag-hint 3s ease-in-out infinite',pointerEvents:'none'}}>
                ⠿ przeciągnij
              </div>
            )}

            <div onMouseDown={startDrag} onTouchStart={startDrag} onClick={handleClick}
                 title={isDragging?'':'Kliknij po panel ze sprawami'}
                 style={{...charAnim(),transformOrigin:'bottom center',display:'block'}}>
              <svg viewBox="0 0 200 240" width={92} height={110} xmlns="http://www.w3.org/2000/svg" overflow="visible">
                <defs>
                  <radialGradient id="gz-body" cx="45%" cy="40%" r="60%">
                    <stop offset="0%"   stopColor="#64B5F6"/><stop offset="100%" stopColor="#1565C0"/>
                  </radialGradient>
                  <radialGradient id="gz-flame" cx="50%" cy="30%" r="60%">
                    <stop offset="0%"   stopColor="#90CAF9"/><stop offset="100%" stopColor="#1976D2"/>
                  </radialGradient>
                  <filter id="gz-sh" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="4" stdDeviation="5" floodOpacity=".22"/>
                  </filter>
                </defs>

                {/* SEASONAL GROUND — behind feet */}
                <SeasonalGroundBack season={seasonal.season}/>

                {/* Ground shadow */}
                <ellipse cx="100" cy="228" rx="50" ry="9" fill="rgba(0,0,0,.09)"/>

                {/* Legs */}
                {!isSleeping&&<>
                  <rect x="72"  y="188" width="22" height="34" rx="11" fill="#1565C0"/>
                  <rect x="106" y="188" width="22" height="34" rx="11" fill="#1565C0"/>
                  <ellipse cx="83"  cy="220" rx="14" ry="8" fill="#0D47A1"/>
                  <ellipse cx="117" cy="220" rx="14" ry="8" fill="#0D47A1"/>
                </>}

                {/* Tool belt */}
                <rect x="58" y="160" width="84" height="16" rx="8" fill="#795548"/>
                <rect x="93" y="158" width="14" height="20" rx="4" fill="#9E9E9E"/>
                <rect x="95" y="160" width="10" height="16" rx="3" fill="#BDBDBD"/>
                <rect x="62" y="162" width="18" height="12" rx="4" fill="#6D4C41"/>
                <rect x="120" y="162" width="18" height="12" rx="4" fill="#6D4C41"/>

                {/* SEASONAL: behind body (bunny ears etc.) */}
                <SeasonalBehind season={seasonal.season}/>

                {/* Body */}
                <ellipse cx="100" cy="130" rx="54" ry="58" fill="url(#gz-body)" filter="url(#gz-sh)"/>

                {/* Flame hair */}
                <path d="M100 30 C90 45 78 38 82 55 C74 42 65 48 70 62 C62 50 56 58 62 72 C72 58 75 65 78 72 C82 55 88 58 92 72 C94 55 100 48 100 72 C106 48 112 55 108 72 C112 58 118 65 122 72 C125 58 128 55 138 72 C138 62 144 50 134 72 C140 58 135 42 126 62 C130 45 118 42 120 55 C124 38 110 45 100 30Z"
                      fill="url(#gz-flame)" opacity=".9"/>

                {/* Hard hat (always rendered; seasonal hat goes on top) */}
                <ellipse cx="100" cy="78" rx="46" ry="12" fill="#ECEFF1"/>
                <path d="M58 78 Q60 50 100 46 Q140 50 142 78Z" fill="#F5F5F5"/>
                <path d="M60 78 Q62 52 100 48 Q138 52 140 78Z" fill="white"/>
                <path d="M100 56 C97 60 94 58 95 62 C93 59 90 61 92 64 C94 61 95 62.5 96 64 C97 61 99 62 100 64 C101 62 103 61 104 64 C105 62.5 106 61 108 64 C110 61 107 59 105 62 C106 58 103 60 100 56Z" fill="#2196F3"/>

                {/* Eyes */}
                {isSleeping?(
                  <><ellipse cx="84" cy="121" rx="11" ry="2" fill="#1565C0"/>
                    <ellipse cx="116" cy="121" rx="11" ry="2" fill="#1565C0"/>
                    <path d="M76 119 Q84 115 92 119" stroke="#1565C0" strokeWidth="1.5" fill="none"/>
                    <path d="M108 119 Q116 115 124 119" stroke="#1565C0" strokeWidth="1.5" fill="none"/></>
                ):(
                  <>{/* Hide eyes when summer sunglasses are on */}
                    {seasonal.season!=='summer'&&<><Eye cx={84} cy={121} closed={eyesClosed}/><Eye cx={116} cy={121} closed={eyesClosed}/></>}
                    <path d="M74 108 Q84 104 94 108" stroke="#1565C0" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    <path d="M106 108 Q116 104 126 108" stroke="#1565C0" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                  </>
                )}

                {/* Cheeks */}
                <ellipse cx="70"  cy="132" rx="10" ry="7" fill="#90CAF9" opacity=".45"/>
                <ellipse cx="130" cy="132" rx="10" ry="7" fill="#90CAF9" opacity=".45"/>

                {/* Mouth */}
                {isSleeping?(
                  <path d="M88 148 Q100 152 112 148" stroke="#0D1117" strokeWidth="2" fill="none" strokeLinecap="round"/>
                ):isTalking?(
                  <g style={{animation:'gz-mouth .35s ease-in-out infinite',transformBox:'fill-box',transformOrigin:'center'}}>
                    <path d="M82 142 Q100 164 118 142" stroke="#0D1117" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    <path d="M84 143 Q100 162 116 143 Q100 168 84 143Z" fill="#E91E63" opacity=".85"/>
                    <path d="M86 144 Q100 153 114 144" fill="white"/>
                  </g>
                ):(
                  <path d="M82 142 Q100 157 118 142" stroke="#0D1117" strokeWidth="2" fill="none" strokeLinecap="round"/>
                )}

                {/* Left arm */}
                {seasonal.season!=='summer'&&(
                  <g style={isWaving?{animation:'gz-wave .6s ease-in-out infinite',transformBox:'fill-box',transformOrigin:'80% 75%'}:{}}>
                    <path d="M50 140 Q30 130 28 118 Q26 108 36 106 Q40 98 46 104 Q50 96 56 100 Q60 92 66 98 Q68 94 72 96 Q74 92 78 95 L76 115 Q64 120 56 140Z" fill="url(#gz-body)"/>
                    <path d="M36 106 Q28 108 26 118 Q28 130 40 126 Q48 122 46 110Z" fill="url(#gz-body)"/>
                  </g>
                )}

                {/* Right arm + wrench (hidden in Easter - replaced by egg) */}
                {seasonal.season!=='easter'&&(
                  <>
                    <path d="M152 135 Q172 125 175 140 L160 160 Q148 165 144 150Z" fill="url(#gz-body)"/>
                    {seasonal.season!=='halloween'&&<>
                      <rect x="160" y="148" width="8" height="28" rx="4" fill="#9E9E9E" transform="rotate(-20 164 162)"/>
                      <ellipse cx="162" cy="150" rx="8" ry="6" fill="#757575" transform="rotate(-20 162 150)"/>
                      <ellipse cx="168" cy="172" rx="6" ry="5" fill="#757575" transform="rotate(-20 168 172)"/>
                    </>}
                  </>
                )}

                {/* ZZZ */}
                {isSleeping&&<>
                  <text x="152" y="88" fontSize="13" fontWeight="bold" fill="#90CAF9" style={{animation:'gz-zzz 2.4s ease-in-out infinite'}} opacity="0">z</text>
                  <text x="163" y="72" fontSize="17" fontWeight="bold" fill="#64B5F6" style={{animation:'gz-zzz 2.4s .8s ease-in-out infinite'}} opacity="0">z</text>
                  <text x="176" y="54" fontSize="22" fontWeight="bold" fill="#42A5F5" style={{animation:'gz-zzz 2.4s 1.6s ease-in-out infinite'}} opacity="0">Z</text>
                </>}

                {/* SEASONAL GROUND — bits in front of feet */}
                <SeasonalGroundFront season={seasonal.season}/>

                {/* SEASONAL: front layer (hats, accessories) */}
                <SeasonalFront season={seasonal.season}/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
