import { redirect } from "next/navigation";

/** Link de convite do sistema antigo: agora todo convite é um desafio. */
export default function ConviteAntigo() {
  redirect("/comecar");
}
