import { redirect } from "next/navigation";

export default function AdminCustomersRedirectPage() {
  redirect("/customers");
}
