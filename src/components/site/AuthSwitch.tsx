'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
export function AuthSwitch({question,href,action}:{question:string;href:string;action:string}){const [destination,setDestination]=useState(href);useEffect(()=>{const p=new URLSearchParams(location.search).get('returnTo');if(p?.startsWith('/')&&!p.startsWith('//')&&!p.includes('\\'))queueMicrotask(()=>setDestination(`${href}?returnTo=${encodeURIComponent(p)}`));},[href]);return <>{question} <Link href={destination} className="text-link">{action}</Link></>;}
