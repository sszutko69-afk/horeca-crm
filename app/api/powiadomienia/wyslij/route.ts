import { NextResponse } from 'next/server'

// Wysyłka powiadomień e-mail przez konto Google właściciela: wyłączona do czasu wdrożenia wysyłki per firma
// (poprzednia wersja używała wspólnego tokenu i domyślnego sekretu).
export async function GET() { return NextResponse.json({ ok: false, komunikat: 'Wysyłka powiadomień jest wyłączona.' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ ok: false, komunikat: 'Wysyłka powiadomień jest wyłączona.' }, { status: 410 }) }
