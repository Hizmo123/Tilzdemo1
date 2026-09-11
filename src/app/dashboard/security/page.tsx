import { requireUser } from "@/lib/auth";
import { SecurityManager } from "./security-manager";
import { PasskeyManager } from "./passkey-manager";

export default async function SecurityPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Security
        </h1>
        <p className="text-muted mt-1">
          Extra protection for your account ({user.email}).
        </p>
      </div>
      <PasskeyManager />
      <SecurityManager />
    </div>
  );
}
