import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <SignUp />
    </main>
  );
}
