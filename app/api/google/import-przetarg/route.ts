import { NextResponse } from 'next/server'

// Import przetargów z Gmaila: wyłączony do czasu przepisania na model wielofirmowy
// (poprzednia wersja działała z kluczem service role poza izolacją firm).
export async function GET() { return NextResponse.json({ ok: false, komunikat: 'Import z Gmaila jest wyłączony.' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ ok: false, komunikat: 'Import z Gmaila jest wyłączony.' }, { status: 410 }) }
