import { NextResponse } from 'next/server'

// Powiadomienia e-mail o przetargach: wyłączone do czasu przepisania na model wielofirmowy
// (poprzednia wersja czytała ustawienia i przetargi wszystkich firm naraz).
export async function GET() { return NextResponse.json({ skipped: true, reason: 'Powiadomienia o przetargach są wyłączone.' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ skipped: true, reason: 'Powiadomienia o przetargach są wyłączone.' }, { status: 410 }) }
