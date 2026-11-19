import { NextResponse } from 'next/server'

// Ręczny zapis pozycji z aplikacji mobilnej: wyłączony (zapis idzie przez synchronizację z trackerem, /api/gps/sync).
export async function POST() { return NextResponse.json({ error: 'Wyłączone. Użyj synchronizacji z trackerem.' }, { status: 410 }) }
