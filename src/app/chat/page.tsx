import { redirect } from "next/navigation";

export default function ChatPage() {
    redirect("/dashboard");
    return null;
}