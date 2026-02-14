import { redirect } from "next/navigation";

export default function ProfilePage() {
  redirect("/overview?panel=profile");
}
