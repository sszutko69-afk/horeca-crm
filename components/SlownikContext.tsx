'use client'

import { createContext, useContext } from 'react'
import { slownik, type Slownik } from '@/lib/slownik'

// Słownik terminologii dostarczany przez AppShell (po wczytaniu branży firmy). Poza providerem: neutralny (nigdy HoReCa).
const Ctx = createContext<Slownik>(slownik(null))

export const SlownikProvider = Ctx.Provider
export function useSlownik(): Slownik {
  return useContext(Ctx)
}
