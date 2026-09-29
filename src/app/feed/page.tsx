import { redirect } from "next/navigation";

/** O feed agora é o Início. */
export default function FeedAntigo() {
  redirect("/painel");
}
