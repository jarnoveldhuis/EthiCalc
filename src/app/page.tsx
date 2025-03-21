// src/app/page.tsx (homepage)
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}