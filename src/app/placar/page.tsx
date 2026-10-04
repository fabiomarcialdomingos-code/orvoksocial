import { redirect } from "next/navigation";

/** O antigo "Meu placar" agora é "Minhas conexões", sem pontuação. */
export default function PlacarPage() { redirect("/conexoes"); }
