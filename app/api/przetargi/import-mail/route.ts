import { NextResponse } from 'next/server'

// Import przetargów z poczty (webhook/Gmail): wyłączony do czasu przepisania na model wielofirmowy.
export async function GET() { return NextResponse.json({ ok: false, komunikat: 'Import z poczty jest wyłączony.' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ ok: false, komunikat: 'Import z poczty jest wyłączony.' }, { status: 410 }) }
