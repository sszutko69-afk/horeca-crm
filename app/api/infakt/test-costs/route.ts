import { NextResponse } from 'next/server'

// Wyłączone: ta trasa używała wspólnego klucza inFakt z konfiguracji serwera (dostęp do danych jednej firmy dla wszystkich).
export async function GET() { return NextResponse.json({ error: 'Wyłączone.' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ error: 'Wyłączone.' }, { status: 410 }) }
