import { redirect } from "next/navigation";

/** O "Meu radar" media pessoas por quanto acertavam. Sem pontuação, o lugar dessa leitura é o Meu retrato. */
export default function RadarPage() { redirect("/retrato"); }
