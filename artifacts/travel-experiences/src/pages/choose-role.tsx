import { useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import { Redirect, useLocation } from "wouter";
import { ArrowRight, CarFront, Compass, ShieldCheck } from "lucide-react";
import {
  selfServiceAccountRoles,
  type AccountRole,
  roleLabel,
  updateAccountRole,
  useCurrentUser,
} from "@/lib/auth";
import { ActionButton, LoadingState } from "@/components/travel-ui";

const roleDetails: Record<AccountRole, { icon: typeof Compass; title: string; detail: string }> = {
  traveler: {
    icon: Compass,
    title: "Ταξιδιώτης",
    detail: "Ανακάλυψε εμπειρίες, ζήτησε custom διαδρομές και κράτησε τη μέρα σου.",
  },
  driver: {
    icon: CarFront,
    title: "Οδηγός",
    detail: "Βρες διαθέσιμες διαδρομές και ανάλαβε τις μετακινήσεις που σου ταιριάζουν.",
  },
  operator: {
    icon: ShieldCheck,
    title: "Operator",
    detail: "Διαχειρίσου συνεργάτες και κράτησε το δίκτυο Aperion αξιόπιστο.",
  },
};

export default function ChooseRole() {
  const { isLoaded, isSignedIn } = useUser();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const profile = useCurrentUser(Boolean(isSignedIn));
  const [selected, setSelected] = useState<AccountRole>("traveler");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded || profile.isLoading) return <LoadingState label="Ετοιμάζουμε τον λογαριασμό σου…" />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (profile.data?.role) return <Redirect to="/" />;

  const saveRole = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateAccountRole(selected);
      await user?.reload();
      await profile.refetch();
      setLocation("/");
    } catch {
      setError("Δεν αποθηκεύτηκε ο ρόλος. Δοκίμασε ξανά.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-5 py-10 md:px-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent">
              <Compass size={22} />
            </span>
            <span>
              <strong className="font-display text-2xl">Aperion</strong>
              <small className="ml-1 block font-mono-ui text-[9px] uppercase tracking-[.2em] text-muted-foreground">
                Travel days
              </small>
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="text-xs font-bold text-muted-foreground hover:text-primary"
          >
            Αποσύνδεση
          </button>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl md:p-10">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-accent">
            Καλώς ήρθες στο Aperion
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-primary md:text-5xl">
            Πώς θα χρησιμοποιήσεις την πλατφόρμα;
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Διάλεξε τον τύπο λογαριασμού σου για να δεις τις σωστές κρατήσεις,
            εργαλεία και ειδοποιήσεις. Μπορείς να το αλλάξεις αργότερα από το προφίλ σου.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {selfServiceAccountRoles.map((role) => {
              const detail = roleDetails[role];
              const Icon = detail.icon;
              const isSelected = selected === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelected(role)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    isSelected
                      ? "border-accent bg-accent/10 shadow-[0_8px_25px_hsl(14_85%_63%/.16)]"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${isSelected ? "bg-accent text-primary" : "bg-muted text-primary"}`}>
                    <Icon size={20} />
                  </span>
                  <span className="mt-5 block font-display text-2xl text-primary">{detail.title}</span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{detail.detail}</span>
                </button>
              );
            })}
          </div>
          {error && <p className="mt-5 text-sm font-semibold text-[#a24d43]">{error}</p>}
          <ActionButton type="button" loading={saving} onClick={saveRole} className="mt-8 w-full sm:w-auto">
            Συνέχεια ως {roleLabel(selected)} <ArrowRight size={16} />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}