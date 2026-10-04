import { redirect } from "next/navigation";

/** Link de convite do sistema antigo: agora todo convite é um convite para o retrato. */
export default function ConviteAntigo() {
  redirect("/comecar");
}
